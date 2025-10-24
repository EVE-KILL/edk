import { BaseWorker } from "../../src/queue/base-worker";
import { db } from "../../src/db";
import { killmails, victims, attackers, entityStats } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../src/utils/logger";

/**
 * Stats Updater Worker
 * Updates entity statistics after a killmail's value has been calculated
 * Triggered by the killmail value updater worker
 *
 * Uses pure incremental updates:
 * - Increments kills/losses by 1
 * - Adds ISK values to destroyed/lost totals
 * - Calculates ratios/efficiency in SQL (only once per entity)
 *
 * Updates stats for:
 * - Victim (character, corporation, alliance)
 * - All attackers (character, corporation, alliance)
 */
export class StatsUpdater extends BaseWorker {
  override queueName = "stats:update";
  override concurrency = 5;

  async handle(payload: any): Promise<void> {
    const { killmailId } = payload;

    if (!killmailId) {
      throw new Error("Missing killmailId in stats update payload");
    }

    try {
      // Fetch the killmail with all related data
      const killmail = await db.query.killmails.findFirst({
        where: eq(killmails.id, killmailId),
      });

      if (!killmail) {
        logger.warn(`Killmail not found for stats update: ${killmailId}`);
        return;
      }

      // Fetch victim data
      const victim = await db.query.victims.findFirst({
        where: eq(victims.killmailId, killmailId),
      });

      // Fetch all attackers
      const killAttackers = await db.query.attackers.findMany({
        where: eq(attackers.killmailId, killmailId),
      });

      if (!victim) {
        logger.warn(`No victim found for killmail ${killmailId}`);
        return;
      }

      // Get total ISK value for this kill
      const iskValue = killmail.totalValue || "0";

      // Build list of entities to update
      const victimStats = this.buildVictimStats(victim);
      const attackerStats = this.buildAttackerStats(killAttackers);

      // Update all victim stats (losses)
      for (const stat of victimStats) {
        await this.incrementStats(stat.type, stat.id, {
          losses: 1,
          iskLost: iskValue,
        });
      }

      // Update all attacker stats (kills)
      for (const stat of attackerStats) {
        await this.incrementStats(stat.type, stat.id, {
          kills: 1,
          iskDestroyed: iskValue,
        });
      }

      const totalUpdated = victimStats.length + attackerStats.length;
      logger.debug(`Updated stats for ${totalUpdated} entities from killmail ${killmailId}`);
    } catch (error) {
      logger.error(`Error updating stats for killmail ${killmailId}:`, error);
      throw error;
    }
  }

  /**
   * Build victim stats to update (character, corporation, alliance)
   */
  private buildVictimStats(victim: any): Array<{ type: string; id: number }> {
    const stats: Array<{ type: string; id: number }> = [];

    if (victim.characterId) {
      stats.push({ type: "character", id: victim.characterId });
    }
    if (victim.corporationId) {
      stats.push({ type: "corporation", id: victim.corporationId });
    }
    if (victim.allianceId) {
      stats.push({ type: "alliance", id: victim.allianceId });
    }

    return stats;
  }

  /**
   * Build attacker stats to update (unique characters, corporations, alliances)
   */
  private buildAttackerStats(
    attackers: any[]
  ): Array<{ type: string; id: number }> {
    const stats: Array<{ type: string; id: number }> = [];
    const uniqueCorps = new Set<number>();
    const uniqueAlliances = new Set<number>();

    for (const attacker of attackers) {
      if (attacker.characterId) {
        stats.push({ type: "character", id: attacker.characterId });
      }
      if (attacker.corporationId) {
        uniqueCorps.add(attacker.corporationId);
      }
      if (attacker.allianceId) {
        uniqueAlliances.add(attacker.allianceId);
      }
    }

    // Add unique corporations and alliances
    for (const corpId of uniqueCorps) {
      stats.push({ type: "corporation", id: corpId });
    }
    for (const allianceId of uniqueAlliances) {
      stats.push({ type: "alliance", id: allianceId });
    }

    return stats;
  }

  /**
   * Increment stats for an entity using pure SQL math
   *
   * This uses SQLite's INSERT ... ON CONFLICT DO UPDATE to:
   * 1. Increment kills/losses by 1
   * 2. Add ISK values to destroyed/lost totals
   * 3. Recalculate ratios and efficiency only once
   */
  private async incrementStats(
    entityType: string,
    entityId: number,
    increments: {
      kills?: number;
      losses?: number;
      iskDestroyed?: string;
      iskLost?: string;
    }
  ): Promise<void> {
    // Use raw SQL for atomic increment with calculated ratios
    const iskDestroyed = increments.iskDestroyed || "0";
    const iskLost = increments.iskLost || "0";
    const killsIncrement = increments.kills || 0;
    const lossesIncrement = increments.losses || 0;

    await db.run(sql`
      INSERT INTO entity_stats (entity_type, entity_id, kills, losses, isk_destroyed, isk_lost, kill_loss_ratio, efficiency, isk_efficiency, updated_at)
      VALUES (${entityType}, ${entityId}, ${killsIncrement}, ${lossesIncrement}, ${iskDestroyed}, ${iskLost},
              CASE WHEN ${lossesIncrement} > 0 THEN CAST(${killsIncrement} AS REAL) / ${lossesIncrement} ELSE ${killsIncrement} END,
              CASE WHEN (${killsIncrement} + ${lossesIncrement}) > 0 THEN (${killsIncrement} * 100.0) / (${killsIncrement} + ${lossesIncrement}) ELSE 0 END,
              CASE WHEN (CAST(${iskDestroyed} AS REAL) + CAST(${iskLost} AS REAL)) > 0 THEN (CAST(${iskDestroyed} AS REAL) * 100.0) / (CAST(${iskDestroyed} AS REAL) + CAST(${iskLost} AS REAL)) ELSE 0 END,
              (unixepoch()))
      ON CONFLICT(entity_type, entity_id) DO UPDATE SET
        kills = kills + ${killsIncrement},
        losses = losses + ${lossesIncrement},
        isk_destroyed = CAST(isk_destroyed AS REAL) + CAST(${iskDestroyed} AS REAL),
        isk_lost = CAST(isk_lost AS REAL) + CAST(${iskLost} AS REAL),
        kill_loss_ratio = CASE
          WHEN (losses + ${lossesIncrement}) > 0
          THEN CAST((kills + ${killsIncrement}) AS REAL) / (losses + ${lossesIncrement})
          ELSE (kills + ${killsIncrement})
        END,
        efficiency = CASE
          WHEN ((kills + ${killsIncrement}) + (losses + ${lossesIncrement})) > 0
          THEN ((kills + ${killsIncrement}) * 100.0) / ((kills + ${killsIncrement}) + (losses + ${lossesIncrement}))
          ELSE 0
        END,
        isk_efficiency = CASE
          WHEN (CAST(isk_destroyed AS REAL) + CAST(${iskDestroyed} AS REAL) + CAST(isk_lost AS REAL) + CAST(${iskLost} AS REAL)) > 0
          THEN ((CAST(isk_destroyed AS REAL) + CAST(${iskDestroyed} AS REAL)) * 100.0) / (CAST(isk_destroyed AS REAL) + CAST(${iskDestroyed} AS REAL) + CAST(isk_lost AS REAL) + CAST(${iskLost} AS REAL))
          ELSE 0
        END,
        updated_at = (unixepoch())
    `);
  }
}
