import { BaseCommand } from "../../../src/commands/base-command";
import { db } from "../../../src/db";
import { killmails, victims, attackers, entityStats } from "../../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Backfill Entity Stats Command
 *
 * Recalculates all entity statistics from scratch (for historical data).
 * This is useful when implementing the feature, backfilling existing data,
 * or if stats get out of sync.
 *
 * The command will:
 * 1. Optionally clear existing stats
 * 2. Iterate through all killmails
 * 3. Calculate stats for each entity (character, corporation, alliance)
 * 4. Batch insert into entity_stats table
 *
 * Usage:
 *   bun cli stats:backfill
 *   bun cli stats:backfill --limit=10000      # Process only 10k killmails
 *   bun cli stats:backfill --dry-run          # Calculate but don't write
 *   bun cli stats:backfill --clear            # Clear existing stats first
 */
export default class BackfillStatsCommand extends BaseCommand {
  override name = "stats:backfill";
  override description = "Recalculate all entity statistics from scratch";
  override usage = "stats:backfill [--limit=<number>] [--dry-run] [--clear]";

  private stats = {
    killmailsProcessed: 0,
    entitiesCalculated: 0,
    batchesWritten: 0,
  };

  async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const limit = parsedArgs.options["limit"]
      ? Number.parseInt(parsedArgs.options["limit"] as string)
      : undefined;
    const dryRun = parsedArgs.flags["dry-run"] === true;
    const clear = parsedArgs.flags["clear"] === true;

    this.info("🔄 Entity Stats Backfill");
    this.info("━".repeat(50));
    this.info("");
    this.info("📋 Configuration:");
    if (limit) {
      this.info(`   Limit: ${limit} killmails`);
    }
    this.info(`   Dry run: ${dryRun}`);
    this.info(`   Clear existing: ${clear}`);
    this.info("");

    try {
      // Clear existing stats if requested
      if (clear && !dryRun) {
        this.info("🗑️  Clearing existing entity stats...");
        await db.delete(entityStats);
        this.info("   ✓ Cleared!");
        this.info("");
      }

      // Get all killmails (with optional limit for testing)
      this.info("📥 Fetching killmails...");
      let query = db
        .select({ id: killmails.id, totalValue: killmails.totalValue })
        .from(killmails);

      if (limit) {
        query = query.limit(limit) as any;
      }

      const allKillmails = await query;
      this.info(`   Found ${allKillmails.length} killmails`);
      this.info("");

      // Map to store entity stats as we calculate them
      const statsMap = new Map<
        string,
        {
          entityType: string;
          entityId: number;
          kills: number;
          losses: number;
          iskDestroyed: number;
          iskLost: number;
        }
      >();

      // Process each killmail
      this.info("📊 Processing killmails...");
      for (let i = 0; i < allKillmails.length; i++) {
        const killmail = allKillmails[i];
        if (!killmail) continue;

        if ((i + 1) % 10000 === 0) {
          this.info(`   ↳ Processed ${i + 1}/${allKillmails.length} (${statsMap.size} unique entities)`);
        }

        // Get victim and attackers
        const victimRecord = await db
          .select()
          .from(victims)
          .where(eq(victims.killmailId, killmail.id))
          .get();

        const attackerRecords = await db
          .select()
          .from(attackers)
          .where(eq(attackers.killmailId, killmail.id));

        if (!victimRecord) continue;

        this.stats.killmailsProcessed++;
        const iskValue = parseFloat(killmail.totalValue || "0");

        // Process victim (this is a LOSS)
        this.updateEntityInMap(
          statsMap,
          "character",
          victimRecord.characterId,
          false,
          iskValue
        );
        this.updateEntityInMap(
          statsMap,
          "corporation",
          victimRecord.corporationId,
          false,
          iskValue
        );
        this.updateEntityInMap(
          statsMap,
          "alliance",
          victimRecord.allianceId,
          false,
          iskValue
        );

        // Process attackers (these are KILLS)
        const attackerCorps = new Set<number>();
        const attackerAlliances = new Set<number>();

        for (const attacker of attackerRecords) {
          this.updateEntityInMap(
            statsMap,
            "character",
            attacker.characterId,
            true,
            iskValue
          );
          if (attacker.corporationId) {
            attackerCorps.add(attacker.corporationId);
          }
          if (attacker.allianceId) {
            attackerAlliances.add(attacker.allianceId);
          }
        }

        for (const corpId of attackerCorps) {
          this.updateEntityInMap(statsMap, "corporation", corpId, true, iskValue);
        }

        for (const allianceId of attackerAlliances) {
          this.updateEntityInMap(statsMap, "alliance", allianceId, true, iskValue);
        }
      }

      this.stats.entitiesCalculated = statsMap.size;
      this.info("");
      this.info(`✓ Calculated stats for ${statsMap.size} unique entities`);
      this.info("");

      // Convert map to array of entity stats with calculated metrics
      const statsArray = Array.from(statsMap.values()).map((stat) => {
        const killLossRatio = stat.losses > 0 ? stat.kills / stat.losses : stat.kills;
        const efficiency =
          stat.kills + stat.losses > 0
            ? (stat.kills / (stat.kills + stat.losses)) * 100
            : 0;
        const iskEfficiency =
          stat.iskDestroyed + stat.iskLost > 0
            ? (stat.iskDestroyed / (stat.iskDestroyed + stat.iskLost)) * 100
            : 0;

        return {
          entityType: stat.entityType,
          entityId: stat.entityId,
          kills: stat.kills,
          losses: stat.losses,
          iskDestroyed: stat.iskDestroyed.toString(),
          iskLost: stat.iskLost.toString(),
          killLossRatio: killLossRatio.toString(),
          efficiency: efficiency.toString(),
          iskEfficiency: iskEfficiency.toString(),
        };
      });

      // Write to database in batches (avoid memory/SQL limits)
      if (!dryRun && statsArray.length > 0) {
        this.info("💾 Writing to database...");
        const batchSize = 1000;
        for (let i = 0; i < statsArray.length; i += batchSize) {
          const batch = statsArray.slice(i, i + batchSize);
          const batchNum = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(statsArray.length / batchSize);
          this.info(`   Batch ${batchNum}/${totalBatches} (${batch.length} entities)...`);
          await db.insert(entityStats).values(batch);
          this.stats.batchesWritten++;
        }
      }

      this.info("");
      this.printFinalStats(dryRun);
    } catch (error) {
      this.error(`❌ Backfill failed: ${error}`);
      throw error;
    }
  }

  private updateEntityInMap(
    map: Map<string, any>,
    entityType: string,
    entityId: number | null,
    isKill: boolean,
    iskValue: number
  ): void {
    if (!entityId) return;

    const key = `${entityType}:${entityId}`;
    const existing = map.get(key) || {
      entityType,
      entityId,
      kills: 0,
      losses: 0,
      iskDestroyed: 0,
      iskLost: 0,
    };

    if (isKill) {
      existing.kills++;
      existing.iskDestroyed += iskValue;
    } else {
      existing.losses++;
      existing.iskLost += iskValue;
    }

    map.set(key, existing);
  }

  private printFinalStats(dryRun: boolean): void {
    this.info("━".repeat(50));
    this.info("📊 Final Statistics:");
    this.info("━".repeat(50));
    this.info(`   Killmails processed: ${this.stats.killmailsProcessed}`);
    this.info(`   Entities calculated: ${this.stats.entitiesCalculated}`);
    this.info(`   Batches written: ${this.stats.batchesWritten}`);
    this.info("━".repeat(50));
    this.info("");

    if (dryRun) {
      this.success(`✅ Dry run complete! Would insert ${this.stats.entitiesCalculated} entities.`);
    } else {
      this.success(
        `✅ Backfill complete! ${this.stats.entitiesCalculated} entities inserted.`
      );
    }
  }

  override showHelp(): void {
    console.log(`
${this.name} - ${this.description}

Usage:
  bun cli ${this.name} [options]

Options:
  --limit=<number>    Process only the first N killmails (default: all)
  --dry-run           Calculate but don't write to database
  --clear             Clear existing entity_stats before backfilling
  --help              Show this help message

Description:
  Recalculates all entity statistics from scratch by iterating through
  killmails and aggregating stats for each character, corporation, and alliance.

  This command is useful when:
  - First implementing the entity stats feature
  - Backfilling historical data
  - Stats get out of sync and need a full recalculation

  The backfill will:
  1. Optionally clear existing entity_stats (with --clear flag)
  2. Iterate through all killmails (or limited by --limit)
  3. For each killmail, update stats for:
     - Victim character, corporation, alliance (loss)
     - All attacker characters, corporations, alliances (kill)
  4. Batch insert into entity_stats table (1000 per batch)

  Performance: ~5,000-10,000 killmails/minute depending on system

Examples:
  bun cli ${this.name}                         # Backfill all killmails
  bun cli ${this.name} --dry-run               # Calculate without writing
  bun cli ${this.name} --limit=10000           # Process first 10k killmails
  bun cli ${this.name} --clear                 # Clear and recalculate all
  bun cli ${this.name} --limit=10000 --dry-run # Test with 10k killmails
`);
  }
}

