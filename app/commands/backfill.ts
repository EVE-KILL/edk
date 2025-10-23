import { BaseCommand } from "../../src/commands/base-command";
import { JobDispatcher } from "../../src/queue/job-dispatcher";
import { db } from "../../src/db";
import { killmails } from "../../db/schema";
import { eq, inArray, or } from "drizzle-orm";

/**
 * Backfill Command
 *
 * Fetches historical killmails from EVE-KILL's API for followed entities.
 * This is useful for populating the database with historical data before
 * starting the real-time RedisQ listener.
 *
 * The command will:
 * 1. Query EVE-KILL for killmails involving followed entities
 * 2. Paginate through results (10,000 per page)
 * 3. Enqueue new killmails for processing
 * 4. Continue until all historical data is fetched
 *
 * Usage:
 *   bun cli backfill
 *   bun cli backfill --limit=10000   # Stop after 10k killmails
 *   bun cli backfill --batch=5000    # Fetch 5000 per page instead of 10000
 *   bun cli backfill --local         # Use local API (localhost:3000)
 */
export default class BackfillCommand extends BaseCommand {
  override name = "backfill";
  override description = "Backfill historical killmails from EVE-KILL";
  override usage = "backfill [--limit=<number>] [--batch=<number>] [--local]";

  private EVE_KILL_API = "https://eve-kill.com/api/export/killmails";
  private dispatcher: JobDispatcher | null = null;
  private followedCharacterIds: number[] = [];
  private followedCorporationIds: number[] = [];
  private followedAllianceIds: number[] = [];
  private stats = {
    fetched: 0,
    new: 0,
    duplicate: 0,
    errors: 0,
    pages: 0,
  };

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const maxKillmails = parsedArgs.options["limit"]
      ? Number.parseInt(parsedArgs.options["limit"] as string)
      : Number.POSITIVE_INFINITY;
    const batchSize = parsedArgs.options["batch"]
      ? Number.parseInt(parsedArgs.options["batch"] as string)
      : 10000; // Increased to 10k per page
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

    this.dispatcher = new JobDispatcher(db);

    this.info("🔄 EVE-KILL Backfill");
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
    this.info(`   Batch size: ${batchSize}`);
    if (maxKillmails !== Number.POSITIVE_INFINITY) {
      this.info(`   Max killmails: ${maxKillmails}`);
    }
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

    // Start backfilling
    let skip = 0;
    while (running && this.stats.fetched < maxKillmails) {
      const result = await this.fetchBatch(batchSize, skip);

      // Stop if we got zero results (error occurred)
      if (result.count === 0) {
        this.info("");
        this.info("⚠️  Received zero results - stopping!");
        break;
      }

      // Stop if we got fewer results than requested (no more data)
      // This is a fallback in case hasMore flag isn't reliable
      if (result.count < batchSize) {
        this.info("");
        this.info("✅ Received fewer than batch size - all data fetched!");
        break;
      }

      // Stop if API says no more data
      if (!result.hasMore) {
        this.info("");
        this.info("✅ No more killmails available - backfill complete!");
        break;
      }

      skip += batchSize;
    }

    // Print final stats
    this.printFinalStats();
  }

  /**
   * Fetch a batch of killmails from EVE-KILL
   */
  private async fetchBatch(
    limit: number,
    skip: number
  ): Promise<{ count: number; hasMore: boolean }> {
    this.stats.pages++;

    // Build filter for new API endpoint
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

    // Build request body for new API
    const requestBody = {
      filter,
      options: {
        limit,
        skip,
      },
    };

    this.info(
      `📡 Fetching page ${this.stats.pages} (skip: ${skip}, limit: ${limit})...`
    );

    try {
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

      const result = await response.json();

      // New API returns: { data: [...], pagination: {...} }
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
      }

      const fetchedKillmails = result.data;

      this.stats.fetched += fetchedKillmails.length;

      // Batch check which killmails already exist (avoid DB lock from individual queries)
      // Split into chunks to avoid SQLite parameter limit (max ~32k params, we use 1000 per chunk)
      const killmailIds = fetchedKillmails.map((km: any) => km.killmail_id);
      const chunkSize = 1000;
      const existingKillmails: Array<{ killmailId: number }> = [];

      // Retry logic for database locks
      let retries = 0;
      const maxRetries = 3;

      // Check in chunks of 1000
      for (let i = 0; i < killmailIds.length; i += chunkSize) {
        const chunk = killmailIds.slice(i, i + chunkSize);

        retries = 0;
        while (retries < maxRetries) {
          try {
            const chunkResults = await db
              .select({ killmailId: killmails.killmailId })
              .from(killmails)
              .where(inArray(killmails.killmailId, chunk))
              .all();
            existingKillmails.push(...chunkResults);
            break; // Success, exit retry loop
          } catch (err: any) {
            if (err.message?.includes("database is locked") && retries < maxRetries - 1) {
              retries++;
              this.info(`   Database locked, retrying (${retries}/${maxRetries})...`);
              await this.sleep(1000 * retries); // Exponential backoff
            } else {
              throw err; // Re-throw if not a lock error or max retries reached
            }
          }
        }
      }

      const existingIds = new Set(existingKillmails.map((km) => km.killmailId));

      // Collect new killmails for batch dispatch
      const newKillmails: Array<{ killmailId: number; hash: string }> = [];

      for (const km of fetchedKillmails) {
        if (existingIds.has(km.killmail_id)) {
          this.stats.duplicate++;
        } else {
          newKillmails.push({
            killmailId: km.killmail_id,
            hash: km.killmail_hash,
          });
        }
      }

      // Batch dispatch all new killmails (chunk to avoid SQLite parameter limits)
      if (newKillmails.length > 0) {
        const dispatchChunkSize = 500; // Conservative chunk size for dispatching

        for (let i = 0; i < newKillmails.length; i += dispatchChunkSize) {
          const chunk = newKillmails.slice(i, i + dispatchChunkSize);

          retries = 0;
          while (retries < maxRetries) {
            try {
              await this.dispatcher!.dispatchMany("killmail-fetch", "fetch", chunk, {
                priority: 50,
                maxAttempts: 3
              });
              this.stats.new += chunk.length;
              break; // Success
            } catch (err: any) {
              if (err.message?.includes("database is locked") && retries < maxRetries - 1) {
                retries++;
                this.info(`   Database locked on dispatch, retrying (${retries}/${maxRetries})...`);
                await this.sleep(1000 * retries); // Exponential backoff
              } else {
                throw err;
              }
            }
          }
        }
      }

      this.printStats();

      // Return pagination info from new API
      return {
        count: fetchedKillmails.length,
        hasMore: result.pagination?.hasMore ?? false,
      };
    } catch (error) {
      this.stats.errors++;
      this.error(`❌ Error fetching batch: ${error}`);
      // Return 0 with no more data to stop on error
      return { count: 0, hasMore: false };
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Print statistics
   */
  private printStats(): void {
    this.info(`   Fetched: ${this.stats.fetched} | New: ${this.stats.new} | Duplicate: ${this.stats.duplicate}`);
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
    this.info(`   New: ${this.stats.new}`);
    this.info(`   Duplicate: ${this.stats.duplicate}`);
    this.info(`   Errors: ${this.stats.errors}`);
    this.info("━".repeat(50));
    this.info("");

    if (this.stats.new > 0) {
      this.success(
        `✅ Backfill complete! ${this.stats.new} new killmails queued for processing.`
      );
      this.info("");
      this.info(
        "💡 Tip: Monitor queue progress with queue workers or check the database."
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
  --limit=<number>   Maximum number of killmails to fetch (default: unlimited)
  --batch=<number>   Number of killmails per page (default: 10000, max: 10000)
  --local            Use local API (http://localhost:3000) instead of production
  --help             Show this help message

Description:
  Fetches historical killmails from EVE-KILL's API for your followed entities.
  The command queries the EVE-KILL database and enqueues killmails for processing.

  Followed entities are configured via environment variables:
  - FOLLOWED_CHARACTER_IDS
  - FOLLOWED_CORPORATION_IDS
  - FOLLOWED_ALLIANCE_IDS

  The backfill will:
  1. Query EVE-KILL for killmails involving your entities
  2. Check which killmails are new (not in your database)
  3. Enqueue new killmails for fetching from ESI
  4. Continue paginating until all historical data is fetched

  Note: This command only enqueues killmails. You need to run queue workers
  to actually fetch and process them.

Examples:
  bun cli ${this.name}                  # Backfill all historical killmails
  bun cli ${this.name} --limit=10000    # Stop after 10,000 killmails
  bun cli ${this.name} --batch=5000     # Fetch 5000 per page
  bun cli ${this.name} --local          # Use local API for testing
`);
  }
}
