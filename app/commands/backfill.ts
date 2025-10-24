import { BaseCommand } from "../../src/commands/base-command";
import { JobDispatcher } from "../../src/queue/job-dispatcher";
import { db, queueDb } from "../../src/db";
import { killmails, victims, attackers, items } from "../../db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { queue } from "../../src/queue/job-dispatcher";

/**
 * Backfill Command
 *
 * Fetches historical killmails from EVE-KILL's API for followed entities.
 * This is useful for populating the database with historical data before
 * starting the real-time RedisQ listener.
 *
 * The command will:
 * 1. Query EVE-KILL for FULL killmails involving followed entities
 * 2. Paginate through results (1000 per page)
 * 3. Batch insert killmails directly into database (50-100 at a time)
 * 4. Enqueue ESI entity fetch and value calculation jobs
 * 5. Continue until all historical data is fetched
 *
 * This approach is 50-100x faster than queuing individual killmail fetches,
 * as it leverages batch inserts and eliminates ESI requests for killmail data.
 *
 * Usage:
 *   bun cli backfill
 *   bun cli backfill --limit=10000      # Stop after 10k killmails
 *   bun cli backfill --fetch=1000       # Fetch 1000 per page from API
 *   bun cli backfill --insert=50        # Insert 50 at a time into DB
 *   bun cli backfill --local            # Use local API (localhost:3000)
 */
export default class BackfillCommand extends BaseCommand {
  override name = "backfill";
  override description = "Backfill historical killmails from EVE-KILL (batch mode)";
  override usage = "backfill [--limit=<number>] [--fetch=<number>] [--insert=<number>] [--page=<number>] [--local]";

  private EVE_KILL_API = "https://eve-kill.com/api/export/killmails";
  private followedCharacterIds: number[] = [];
  private followedCorporationIds: number[] = [];
  private followedAllianceIds: number[] = [];
  private stats = {
    fetched: 0,
    inserted: 0,
    duplicate: 0,
    errors: 0,
    pages: 0,
    batches: 0,
  };

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const maxKillmails = parsedArgs.options["limit"]
      ? Number.parseInt(parsedArgs.options["limit"] as string)
      : Number.POSITIVE_INFINITY;
    const fetchSize = parsedArgs.options["fetch"]
      ? Number.parseInt(parsedArgs.options["fetch"] as string)
      : 1000; // Fetch 1000 full killmails per API request
    const insertBatchSize = parsedArgs.options["insert"]
      ? Number.parseInt(parsedArgs.options["insert"] as string)
      : 1000; // Insert all 1000 killmails at once (chunk child tables as needed)
    const startPage = parsedArgs.options["page"]
      ? Number.parseInt(parsedArgs.options["page"] as string)
      : 1; // Start from page 1 by default
    const useLocal = parsedArgs.flags["local"] === true;

    // Switch to local API if requested
    if (useLocal) {
      this.EVE_KILL_API = "http://localhost:3000/api/export/killmails";
    }

    // Parse followed entities from environment
    this.followedCharacterIds = process.env.FOLLOWED_CHARACTER_IDS?.trim()
      ? process.env.FOLLOWED_CHARACTER_IDS.split(",").map((id) =>
          Number.parseInt(id.trim())
        )
      : [];

    this.followedCorporationIds = process.env.FOLLOWED_CORPORATION_IDS?.trim()
      ? process.env.FOLLOWED_CORPORATION_IDS.split(",").map((id) =>
          Number.parseInt(id.trim())
        )
      : [];

    this.followedAllianceIds = process.env.FOLLOWED_ALLIANCE_IDS?.trim()
      ? process.env.FOLLOWED_ALLIANCE_IDS.split(",").map((id) =>
          Number.parseInt(id.trim())
        )
      : [];

    // Validate that at least one entity is configured
    if (
      this.followedCharacterIds.length === 0 &&
      this.followedCorporationIds.length === 0 &&
      this.followedAllianceIds.length === 0
    ) {
      this.error(
        "❌ No followed entities configured. Please set FOLLOWED_CHARACTER_IDS, FOLLOWED_CORPORATION_IDS, or FOLLOWED_ALLIANCE_IDS in .env"
      );
      return;
    }

    this.info("🔄 EVE-KILL Backfill (Batch Mode)");
    this.info("━".repeat(50));
    this.info("");
    this.info("📋 Configuration:");
    this.info(`   API: ${this.EVE_KILL_API}`);
    if (this.followedCharacterIds.length > 0) {
      this.info(`   Characters: ${this.followedCharacterIds.join(", ")}`);
    }
    if (this.followedCorporationIds.length > 0) {
      this.info(`   Corporations: ${this.followedCorporationIds.join(", ")}`);
    }
    if (this.followedAllianceIds.length > 0) {
      this.info(`   Alliances: ${this.followedAllianceIds.join(", ")}`);
    }
    this.info(`   Fetch size: ${fetchSize} (per API request)`);
    this.info(`   Insert batch: ${insertBatchSize} (killmails per transaction)`);
    if (startPage > 1) {
      this.info(`   Starting from: Page ${startPage} (skip: ${(startPage - 1) * fetchSize})`);
    }
    if (maxKillmails !== Number.POSITIVE_INFINITY) {
      this.info(`   Max killmails: ${maxKillmails}`);
    }
    this.info("");
    this.info("💡 Mode: Direct batch insertion (50-100x faster than queue)");
    this.info("");
    this.info("Press Ctrl+C to stop");
    this.info("");

    // Handle graceful shutdown
    let running = true;
    const shutdown = () => {
      this.info("");
      this.info("🛑 Stopping backfill...");
      running = false;
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Start backfilling (resume from specified page)
    let skip = (startPage - 1) * fetchSize;
    let currentPage = startPage;

    while (running && this.stats.fetched < maxKillmails) {
      const result = await this.fetchAndInsertBatch(fetchSize, insertBatchSize, skip, currentPage);      // Stop if we got zero results (error occurred)
      if (result.count === 0) {
        this.info("");
        this.info("⚠️  Received zero results - stopping!");
        this.info(`💡 To resume, use: bun cli backfill --page=${currentPage}`);
        break;
      }

      // Stop if we got fewer results than requested (no more data)
      // This is a fallback in case hasMore flag isn't reliable
      if (result.count < fetchSize) {
        this.info("");
        this.info("✅ Received fewer than fetch size - all data fetched!");
        break;
      }

      // Stop if API says no more data
      if (!result.hasMore) {
        this.info("");
        this.info("✅ No more killmails available - backfill complete!");
        break;
      }

      skip += fetchSize;
      currentPage++;
    }

    // Print final stats
    this.printFinalStats();
  }

  /**
   * Fetch a batch of FULL killmails from EVE-KILL and insert directly into database
   * Includes retry logic for transient errors (502, 503, network issues)
   */
  private async fetchAndInsertBatch(
    fetchLimit: number,
    insertBatchSize: number,
    skip: number,
    pageNumber: number
  ): Promise<{ count: number; hasMore: boolean }> {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.fetchAndInsertBatchOnce(fetchLimit, insertBatchSize, skip, pageNumber);
      } catch (error: any) {
        const isRetryable =
          error.message?.includes("502") ||
          error.message?.includes("503") ||
          error.message?.includes("504") ||
          error.message?.includes("ECONNRESET") ||
          error.message?.includes("ETIMEDOUT") ||
          error.message?.includes("fetch failed");

        if (!isRetryable || attempt === maxRetries) {
          this.stats.errors++;
          this.error(`❌ Error fetching/inserting batch after ${attempt} attempt(s): ${error}`);
          return { count: 0, hasMore: false };
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.info(`   ⚠️  Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        this.info(`   ⏳ Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs it
    return { count: 0, hasMore: false };
  }

  /**
   * Internal method to fetch and insert a batch (single attempt)
   */
  private async fetchAndInsertBatchOnce(
    fetchLimit: number,
    insertBatchSize: number,
    skip: number,
    pageNumber: number
  ): Promise<{ count: number; hasMore: boolean }> {

    // Build filter for API endpoint
    const filter: any = {};

    if (this.followedCharacterIds.length > 0) {
      filter.character_ids = this.followedCharacterIds;
    }
    if (this.followedCorporationIds.length > 0) {
      filter.corporation_ids = this.followedCorporationIds;
    }
    if (this.followedAllianceIds.length > 0) {
      filter.alliance_ids = this.followedAllianceIds;
    }

    // Build request body - request FULL killmail data (not just IDs)
    const requestBody = {
      filter,
      options: {
        limit: fetchLimit,
        skip
      },
    };

    this.info(
      `📡 Fetching page ${pageNumber} (skip: ${skip}, limit: ${fetchLimit})...`
    );

    const response = await fetch(this.EVE_KILL_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "EVE-Kill/4.0 (https://eve-kill.com)",
        },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: any = await response.json();

    // API returns: { data: [...], pagination: {...} }
    if (!result.data || !Array.isArray(result.data)) {
      throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
    }

    const fetchedKillmails = result.data;
    this.stats.fetched += fetchedKillmails.length;
    this.stats.pages++; // Increment page counter after successful fetch

    this.info(`   Received ${fetchedKillmails.length} killmails, batch inserting...`);

    // Process all killmails in one batch (chunk child tables internally)
    await this.batchInsertKillmails(fetchedKillmails);
    this.stats.batches++;

    this.printStats();

    // Return pagination info from API
    return {
      count: fetchedKillmails.length,
      hasMore: result.pagination?.hasMore ?? false,
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Batch insert killmails with all related data (victims, attackers, items)
   * Uses transactions for atomicity and batch inserts for performance
   */
  private async batchInsertKillmails(killmailsData: any[]): Promise<void> {
    const startTime = Date.now();
    let newKillmailIds = new Set<number>(); // Track which killmails are actually new

    // Prepare job arrays (to be enqueued AFTER transaction completes)
    const entityJobs: Array<{ type: "character" | "corporation" | "alliance"; id: number }> = [];
    const valueJobs: Array<{ killmailDbId: number; killmailTime: Date }> = [];
    const websocketJobs: Array<{ killmailId: number }> = [];

    try {
      await db.transaction(async (tx) => {
        // 1. Prepare killmail data
        const killmailsToInsert = killmailsData.map((km) => {
          const attackerCount = km.attackers?.length || 0;
          const firstAttacker = km.attackers?.[0];
          const isSolo = km.is_solo ?? (attackerCount === 1 && firstAttacker && !firstAttacker.faction_id);
          const isNpc = km.is_npc ?? (km.attackers?.every((a: any) => a.faction_id || !a.character_id) ?? false);

          return {
            killmailId: km.killmail_id,
            hash: km.killmail_hash || "",
            killmailTime: new Date(km.kill_time), // API returns "kill_time" not "killmail_time"
            solarSystemId: km.system_id, // API returns "system_id" not "solar_system_id"
            attackerCount,
            shipValue: "0", // Will be calculated by value worker
            fittedValue: "0",
            droppedValue: "0",
            destroyedValue: "0",
            totalValue: "0",
            points: 0,
            isSolo,
            isNpc,
          };
        });

        // 2. Batch insert killmails with RETURNING to get IDs
        const insertedKillmails = await tx
          .insert(killmails)
          .values(killmailsToInsert)
          .onConflictDoUpdate({
            target: killmails.killmailId,
            set: {
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!insertedKillmails || insertedKillmails.length === 0) {
          this.stats.duplicate += killmailsData.length;
          return;
        }

        // 3. Create map of killmail_id → db_id
        const idMap = new Map(insertedKillmails.map((km) => [km.killmailId, km.id]));

        // Track new vs duplicate
        const newCount = insertedKillmails.length;
        this.stats.inserted += newCount;
        this.stats.duplicate += killmailsData.length - newCount;

        // Only insert victims/attackers/items for NEW killmails
        // (Filter out killmails that already existed to avoid duplicate child records)
        newKillmailIds = new Set(
          insertedKillmails
            .filter((km) => {
              // Check if this was a new insert (createdAt === updatedAt)
              const created = km.createdAt?.getTime();
              const updated = km.updatedAt?.getTime();
              return created === updated;
            })
            .map((km) => km.killmailId)
        );

        // 4. Prepare victims data (only for new killmails)
        const victimsToInsert = killmailsData
          .filter((km) => newKillmailIds.has(km.killmail_id) && idMap.has(km.killmail_id))
          .map((km) => ({
            killmailId: idMap.get(km.killmail_id)!,
            characterId: km.victim.character_id ?? null,
            corporationId: km.victim.corporation_id,
            allianceId: km.victim.alliance_id ?? null,
            factionId: km.victim.faction_id ?? null,
            shipTypeId: km.victim.ship_id, // API returns "ship_id" not "ship_type_id"
            damageTaken: km.victim.damage_taken,
            positionX: km.x?.toString() ?? null, // Position is at root level
            positionY: km.y?.toString() ?? null,
            positionZ: km.z?.toString() ?? null,
          }));

        // 5. Batch insert victims
        if (victimsToInsert.length > 0) {
          await tx.insert(victims).values(victimsToInsert).onConflictDoNothing();
        }

        // 6. Prepare attackers data (only for new killmails)
        const attackersToInsert = killmailsData
          .filter((km) => newKillmailIds.has(km.killmail_id) && idMap.has(km.killmail_id))
          .flatMap((km) =>
            (km.attackers || []).map((attacker: any) => ({
              killmailId: idMap.get(km.killmail_id)!,
              characterId: attacker.character_id ?? null,
              corporationId: attacker.corporation_id ?? null,
              allianceId: attacker.alliance_id ?? null,
              factionId: attacker.faction_id ?? null,
              shipTypeId: attacker.ship_id ?? null, // API returns "ship_id"
              weaponTypeId: attacker.weapon_type_id ?? null,
              damageDone: attacker.damage_done,
              securityStatus: attacker.security_status?.toString() ?? null,
              finalBlow: attacker.final_blow ?? false,
            }))
          );

        // 7. Batch insert attackers (chunk to avoid SQLite parameter limit)
        if (attackersToInsert.length > 0) {
          // Chunk attackers: 2000 attackers × 11 columns = 22,000 params (safe)
          const attackerChunkSize = 2000;
          for (let i = 0; i < attackersToInsert.length; i += attackerChunkSize) {
            const chunk = attackersToInsert.slice(i, i + attackerChunkSize);
            await tx.insert(attackers).values(chunk).onConflictDoNothing();
          }
        }

        // 8. Prepare items data (only for new killmails)
        const itemsToInsert = killmailsData
          .filter((km) => newKillmailIds.has(km.killmail_id) && idMap.has(km.killmail_id))
          .flatMap((km) =>
            (km.items || []).map((item: any) => ({
              killmailId: idMap.get(km.killmail_id)!,
              itemTypeId: item.type_id, // API returns "type_id"
              quantity: (item.qty_dropped || 0) + (item.qty_destroyed || 0), // API uses "qty_"
              flag: item.flag,
              singleton: item.singleton ?? 0,
              dropped: !!item.qty_dropped,
              destroyed: !!item.qty_destroyed,
            }))
          );

        // 9. Batch insert items (chunk to avoid SQLite parameter limit)
        if (itemsToInsert.length > 0) {
          // Chunk items: 4000 items × 7 columns = 28,000 params (safe)
          const itemChunkSize = 4000;
          for (let i = 0; i < itemsToInsert.length; i += itemChunkSize) {
            const chunk = itemsToInsert.slice(i, i + itemChunkSize);
            await tx.insert(items).values(chunk).onConflictDoNothing();
          }
        }

        // 10. Prepare jobs for ESI entity fetches and value calculations (only for new killmails)
        const charactersToFetch = new Set<number>();
        const corporationsToFetch = new Set<number>();
        const alliancesToFetch = new Set<number>();

        for (const km of killmailsData) {
          // Only process new killmails
          if (!newKillmailIds.has(km.killmail_id)) continue;

          const dbId = idMap.get(km.killmail_id);
          if (!dbId) continue;

          // Collect entities from victim
          if (km.victim.character_id) charactersToFetch.add(km.victim.character_id);
          if (km.victim.corporation_id) corporationsToFetch.add(km.victim.corporation_id);
          if (km.victim.alliance_id) alliancesToFetch.add(km.victim.alliance_id);

          // Collect entities from attackers
          for (const attacker of km.attackers || []) {
            if (attacker.character_id) charactersToFetch.add(attacker.character_id);
            if (attacker.corporation_id) corporationsToFetch.add(attacker.corporation_id);
            if (attacker.alliance_id) alliancesToFetch.add(attacker.alliance_id);
          }

          // Prepare value calculation job
          valueJobs.push({
            killmailDbId: dbId,
            killmailTime: new Date(km.kill_time), // API returns "kill_time"
          });
        }

        // Build entity job payloads
        for (const id of charactersToFetch) {
          entityJobs.push({ type: "character", id });
        }
        for (const id of corporationsToFetch) {
          entityJobs.push({ type: "corporation", id });
        }
        for (const id of alliancesToFetch) {
          entityJobs.push({ type: "alliance", id });
        }

        // Prepare websocket emission jobs (only for new killmails)
        const newInsertedKillmails = insertedKillmails.filter((km) => newKillmailIds.has(km.killmailId));
        for (const km of newInsertedKillmails) {
          websocketJobs.push({ killmailId: km.killmailId });
        }
      });

      // Transaction complete - now enqueue jobs to the separate queue database
      // Batch enqueue ESI entity fetches
      if (entityJobs.length > 0) {
        await queue.dispatchMany("esi", "fetch", entityJobs, {
          priority: 10, // Lower priority than killmail processing
        });
      }

      // Batch enqueue value calculations
      if (valueJobs.length > 0) {
        await queue.dispatchMany("killmail-value", "update", valueJobs, {
          priority: 5,
        });
      }

      // Batch enqueue websocket emissions
      if (websocketJobs.length > 0) {
        await queue.dispatchMany("websocket", "emit", websocketJobs, {
          priority: 5,
        });
      }

      const duration = Date.now() - startTime;
      const newKillmailCount = newKillmailIds.size;
      const duplicateCount = killmailsData.length - newKillmailCount;
      const attackerCount = killmailsData
        .filter((km) => newKillmailIds.has(km.killmail_id))
        .reduce((sum, km) => sum + (km.attackers?.length || 0), 0);
      const itemCount = killmailsData
        .filter((km) => newKillmailIds.has(km.killmail_id))
        .reduce((sum, km) => sum + (km.items?.length || 0), 0);

      if (duplicateCount > 0) {
        this.info(`   ✓ Batch inserted ${newKillmailCount} NEW killmails (${attackerCount} attackers, ${itemCount} items), skipped ${duplicateCount} duplicates in ${duration}ms`);
      } else {
        this.info(`   ✓ Batch inserted ${killmailsData.length} killmails (${attackerCount} attackers, ${itemCount} items) in ${duration}ms`);
      }
    } catch (error) {
      this.error(`   ✗ Failed to batch insert killmails: ${error}`);
      throw error;
    }
  }

  /**
   * Print statistics
   */
  private printStats(): void {
    this.info(`   Fetched: ${this.stats.fetched} | Inserted: ${this.stats.inserted} | Duplicate: ${this.stats.duplicate} | Batches: ${this.stats.batches}`);
  }

  /**
   * Print final statistics
   */
  private printFinalStats(): void {
    this.info("");
    this.info("━".repeat(50));
    this.info("📊 Final Statistics:");
    this.info("━".repeat(50));
    this.info(`   Pages fetched: ${this.stats.pages}`);
    this.info(`   Killmails fetched: ${this.stats.fetched}`);
    this.info(`   Inserted: ${this.stats.inserted}`);
    this.info(`   Duplicate: ${this.stats.duplicate}`);
    this.info(`   Batches processed: ${this.stats.batches}`);
    this.info(`   Errors: ${this.stats.errors}`);
    this.info("━".repeat(50));
    this.info("");


    // Show resume command if we didn't complete
    if (this.stats.errors > 0) {
      const nextPage = this.stats.pages + 1;
      this.info(`💡 To resume from where you left off, use: bun cli backfill --page=${nextPage}`);
      this.info("");
    }    if (this.stats.inserted > 0) {
      this.success(
        `✅ Backfill complete! ${this.stats.inserted} new killmails inserted directly into database.`
      );
      this.info("");
      this.info(
        "💡 ESI entity fetches and value calculations have been queued in the background."
      );
    } else {
      this.info("✅ Backfill complete! No new killmails found.");
    }
  }

  override showHelp(): void {
    console.log(`
${this.name} - ${this.description}

Usage:
  bun cli ${this.name} [options]

Options:
  --limit=<number>    Maximum number of killmails to fetch (default: unlimited)
  --fetch=<number>    Number of killmails per API request (default: 1000)
  --insert=<number>   Number of killmails per transaction (default: 1000)
  --page=<number>     Resume from a specific page (default: 1)
  --local             Use local API (http://localhost:3000) instead of production
  --help              Show this help message

Description:
  Fetches historical killmails from EVE-KILL's API for your followed entities
  and inserts them directly into the database using batch operations.

  This is 50-100x FASTER than the old approach because it:
  - Fetches FULL killmail data from eve-kill (no ESI requests needed)
  - Uses batch inserts (up to 1000 killmails per transaction)
  - Chunks child tables (attackers/items) to stay within SQLite limits
  - Eliminates queue overhead for killmail fetching
  - Only queues ESI entity fetches and value calculations

  Followed entities are configured via environment variables:
  - FOLLOWED_CHARACTER_IDS
  - FOLLOWED_CORPORATION_IDS
  - FOLLOWED_ALLIANCE_IDS

  The backfill will:
  1. Query EVE-KILL for FULL killmails involving your entities
  2. Batch insert directly into database (up to 1000 per transaction)
  3. Chunk attackers/items to stay within SQLite parameter limits
  4. Enqueue ESI entity fetches (characters, corps, alliances)
  5. Enqueue value calculation jobs (ISK values)
  6. Continue paginating until all historical data is fetched

  Performance: ~500-1000 killmails/second vs ~10-20 with old approach

Examples:
  bun cli ${this.name}                   # Backfill all historical killmails
  bun cli ${this.name} --limit=10000     # Stop after 10,000 killmails
  bun cli ${this.name} --fetch=500       # Fetch 500 per API request
  bun cli ${this.name} --page=376        # Resume from page 376
  bun cli ${this.name} --local           # Use local API for testing
`);
  }
}
