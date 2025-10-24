import { BaseWorker } from "../../src/queue/base-worker";
import { db } from "../../src/db";
import { killmails, victims, attackers, types, groups, shipGroupStats } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../../src/utils/logger";

/**
 * Per-Entity Ship Group Stats Updater Worker
 * Updates per-entity ship group statistics after a killmail's value has been calculated
 * Triggered by the killmail value updater worker
 *
 * Uses pure incremental updates via SQL:
 * - Increments losses for victim's entity (character, corporation, alliance)
 * - Increments kills for each attacker's entity (character, corporation, alliance)
 * - Tracks kills/losses per ship group for each entity
 *
 * Updates stats for:
 * - Victim (character, corporation, alliance) - increments losses
 * - All attackers (character, corporation, alliance) - increments kills
 */
export class ShipGroupStatsUpdater extends BaseWorker {
  override queueName = "ship-group-stats:update";
  override concurrency = 5;

  async handle(payload: any): Promise<void> {
    const { killmailId } = payload;

    if (!killmailId) {
      throw new Error("Missing killmailId in ship group stats update payload");
    }

    try {
      // Fetch the victim data for this killmail
      const victim = await db.query.victims.findFirst({
        where: eq(victims.killmailId, killmailId),
      });

      if (!victim) {
        logger.warn(`No victim found for killmail ${killmailId}`);
        return;
      }

      // Fetch the victim's ship type to get the group
      const type = await db.query.types.findFirst({
        where: eq(types.typeId, victim.shipTypeId),
      });

      if (!type) {
        logger.warn(`Ship type not found for victim in killmail ${killmailId}`);
        return;
      }

      // Fetch the group to get group name
      const group = await db.query.groups.findFirst({
        where: eq(groups.groupId, type.groupId),
      });

      if (!group) {
        logger.warn(`Group not found for ship type ${victim.shipTypeId}`);
        return;
      }

      // Update victim's losses for this ship group
      const victimStats = this.buildVictimStats(victim);
      for (const stat of victimStats) {
        await this.incrementShipGroupStats(stat.type, stat.id, type.groupId, group.name, {
          losses: 1,
        });
      }

      // Fetch all attackers and update their kills
      const killAttackers = await db.query.attackers.findMany({
        where: eq(attackers.killmailId, killmailId),
      });

      const attackerStats = this.buildAttackerStats(killAttackers);
      for (const stat of attackerStats) {
        await this.incrementShipGroupStats(stat.type, stat.id, type.groupId, group.name, {
          kills: 1,
        });
      }

      const totalUpdated = victimStats.length + attackerStats.length;
      logger.debug(
        `Updated ship group stats for ${totalUpdated} entities from killmail ${killmailId}`
      );
    } catch (error) {
      logger.error(`Error updating ship group stats for killmail ${killmailId}:`, error);
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
   * Increment stats for a ship group per entity using pure SQL math
   *
   * This uses SQLite's INSERT ... ON CONFLICT DO UPDATE to:
   * 1. Ensure the (entity_type, entity_id, group_id) row exists
   * 2. Increment kills or losses by 1
   * 3. Update the timestamp
   */
  private async incrementShipGroupStats(
    entityType: string,
    entityId: number,
    groupId: number,
    groupName: string,
    increments: {
      kills?: number;
      losses?: number;
    }
  ): Promise<void> {
    const killsIncrement = increments.kills || 0;
    const lossesIncrement = increments.losses || 0;

    await db.run(sql`
      INSERT INTO ship_group_stats (entity_type, entity_id, group_id, group_name, kills, losses, created_at, updated_at)
      VALUES (${entityType}, ${entityId}, ${groupId}, ${groupName}, ${killsIncrement}, ${lossesIncrement}, (unixepoch()), (unixepoch()))
      ON CONFLICT(entity_type, entity_id, group_id) DO UPDATE SET
        kills = kills + ${killsIncrement},
        losses = losses + ${lossesIncrement},
        updated_at = (unixepoch())
    `);
  }
}

