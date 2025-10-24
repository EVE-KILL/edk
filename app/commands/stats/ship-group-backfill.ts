import { BaseCommand } from "../../../src/commands/base-command";
import { db } from "../../../src/db";
import { killmails, victims, attackers, types, groups, shipGroupStats } from "../../../db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Backfill Per-Entity Ship Group Stats Command
 *
 * Recalculates all per-entity ship group statistics from scratch (for historical data).
 * This is useful when implementing the feature, backfilling existing data,
 * or if stats get out of sync.
 *
 * The command will:
 * 1. Optionally clear existing stats
 * 2. Iterate through all killmails
 * 3. Extract victim's ship group and update victim's entity losses
 * 4. Extract attacker ship group and update attacker's entity kills
 * 5. Batch insert into ship_group_stats table
 *
 * Usage:
 *   bun cli ship-group-stats:backfill
 *   bun cli ship-group-stats:backfill --limit=10000      # Process only 10k killmails
 *   bun cli ship-group-stats:backfill --dry-run          # Calculate but don't write
 *   bun cli ship-group-stats:backfill --clear            # Clear existing stats first
 */
export default class BackfillShipGroupStatsCommand extends BaseCommand {
  override name = "ship-group-stats:backfill";
  override description = "Recalculate all per-entity ship group statistics from scratch";
  override usage = "ship-group-stats:backfill [--limit=<number>] [--dry-run] [--clear]";

  private stats = {
    killmailsProcessed: 0,
    statsCalculated: 0,
    batchesWritten: 0,
  };

  async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const limit = parsedArgs.options["limit"]
      ? Number.parseInt(parsedArgs.options["limit"] as string)
      : undefined;
    const dryRun = parsedArgs.flags["dry-run"] === true;
    const clear = parsedArgs.flags["clear"] === true;

    this.info("🔄 Per-Entity Ship Group Stats Backfill");
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
        this.info("🗑️  Clearing existing ship group stats...");
        await db.delete(shipGroupStats);
        this.info("   ✓ Cleared!");
        this.info("");
      }

      // Get all killmails (with optional limit for testing)
      this.info("📥 Fetching killmails...");
      let query = db
        .select({ id: killmails.id })
        .from(killmails);

      if (limit) {
        query = query.limit(limit) as any;
      }

      const allKillmails = await query;
      this.info(`   Found ${allKillmails.length} killmails`);
      this.info("");

      // Map to store ship group stats as we calculate them
      // Key format: "entityType:entityId:groupId"
      const statsMap = new Map<
        string,
        {
          entityType: string;
          entityId: number;
          groupId: number;
          groupName: string;
          kills: number;
          losses: number;
        }
      >();

      // Process each killmail
      this.info("📊 Processing killmails...");
      for (let i = 0; i < allKillmails.length; i++) {
        const killmail = allKillmails[i];
        if (!killmail) continue;

        if ((i + 1) % 10000 === 0) {
          this.info(
            `   ↳ Processed ${i + 1}/${allKillmails.length} (${statsMap.size} unique stats)`
          );
        }

        // Get victim data
        const victim = await db.query.victims.findFirst({
          where: eq(victims.killmailId, killmail.id),
        });

        if (!victim) continue;

        // Get ship type
        const shipType = await db.query.types.findFirst({
          where: eq(types.typeId, victim.shipTypeId),
        });

        if (!shipType) continue;

        // Get group info
        const groupInfo = await db.query.groups.findFirst({
          where: eq(groups.groupId, shipType.groupId),
        });

        if (!groupInfo) continue;

        // Update victim's losses for this ship group (character, corporation, alliance)
        if (victim.characterId) {
          this.updateStats(
            statsMap,
            "character",
            victim.characterId,
            shipType.groupId,
            groupInfo.name,
            { losses: 1 }
          );
        }
        if (victim.corporationId) {
          this.updateStats(
            statsMap,
            "corporation",
            victim.corporationId,
            shipType.groupId,
            groupInfo.name,
            { losses: 1 }
          );
        }
        if (victim.allianceId) {
          this.updateStats(
            statsMap,
            "alliance",
            victim.allianceId,
            shipType.groupId,
            groupInfo.name,
            { losses: 1 }
          );
        }

        // Get attackers and update their kills
        const killAttackers = await db.query.attackers.findMany({
          where: eq(attackers.killmailId, killmail.id),
        });

        const uniqueCorps = new Set<number>();
        const uniqueAlliances = new Set<number>();

        for (const attacker of killAttackers) {
          // Update character kills
          if (attacker.characterId) {
            this.updateStats(
              statsMap,
              "character",
              attacker.characterId,
              shipType.groupId,
              groupInfo.name,
              { kills: 1 }
            );
          }
          if (attacker.corporationId) {
            uniqueCorps.add(attacker.corporationId);
          }
          if (attacker.allianceId) {
            uniqueAlliances.add(attacker.allianceId);
          }
        }

        // Update unique corporations and alliances
        for (const corpId of uniqueCorps) {
          this.updateStats(
            statsMap,
            "corporation",
            corpId,
            shipType.groupId,
            groupInfo.name,
            { kills: 1 }
          );
        }
        for (const allianceId of uniqueAlliances) {
          this.updateStats(
            statsMap,
            "alliance",
            allianceId,
            shipType.groupId,
            groupInfo.name,
            { kills: 1 }
          );
        }

        this.stats.killmailsProcessed++;
      }

      this.stats.statsCalculated = statsMap.size;
      this.info(`   ✓ Calculated stats for ${statsMap.size} entity/group combinations`);
      this.info("");

      if (dryRun) {
        this.info("⏭️  Dry run enabled - not writing to database");
        this.info("");
        this.logStats();
        return;
      }

      // Batch write stats to database (1000 at a time)
      this.info("💾 Writing to database...");
      const BATCH_SIZE = 1000;
      let batchIndex = 0;

      const statsArray = Array.from(statsMap.values());
      for (let i = 0; i < statsArray.length; i += BATCH_SIZE) {
        const batch = statsArray.slice(i, i + BATCH_SIZE);

        // Insert with SQL for each record using raw SQL
        for (const stat of batch) {
          await db.run(sql`
            INSERT INTO ship_group_stats (entity_type, entity_id, group_id, group_name, kills, losses, created_at, updated_at)
            VALUES (${stat.entityType}, ${stat.entityId}, ${stat.groupId}, ${stat.groupName}, ${stat.kills}, ${stat.losses}, (unixepoch()), (unixepoch()))
            ON CONFLICT(entity_type, entity_id, group_id) DO UPDATE SET
              kills = excluded.kills,
              losses = excluded.losses,
              updated_at = (unixepoch())
          `);
        }

        batchIndex++;
        if (batchIndex % 10 === 0) {
          this.info(`   ↳ Batch ${batchIndex} written`);
        }
      }

      this.stats.batchesWritten = Math.ceil(statsArray.length / BATCH_SIZE);
      this.info(
        `   ✓ Written ${statsArray.length} records in ${this.stats.batchesWritten} batches`
      );
      this.info("");

      this.logStats();
    } catch (error) {
      this.error(`❌ Error during backfill: ${error}`);
      throw error;
    }
  }

  /**
   * Helper to update stats in the map
   */
  private updateStats(
    statsMap: Map<
      string,
      {
        entityType: string;
        entityId: number;
        groupId: number;
        groupName: string;
        kills: number;
        losses: number;
      }
    >,
    entityType: string,
    entityId: number,
    groupId: number,
    groupName: string,
    increments: { kills?: number; losses?: number }
  ): void {
    const key = `${entityType}:${entityId}:${groupId}`;
    const existing = statsMap.get(key);

    if (existing) {
      existing.kills += increments.kills || 0;
      existing.losses += increments.losses || 0;
    } else {
      statsMap.set(key, {
        entityType,
        entityId,
        groupId,
        groupName,
        kills: increments.kills || 0,
        losses: increments.losses || 0,
      });
    }
  }

  private logStats(): void {
    this.info("📈 Summary:");
    this.info(`   Killmails processed: ${this.stats.killmailsProcessed}`);
    this.info(`   Stats calculated: ${this.stats.statsCalculated}`);
    this.info(`   Batches written: ${this.stats.batchesWritten}`);
    this.info("");
    this.success("✓ Backfill complete!");
  }
}
