import { BaseWorker } from "../../src/queue/base-worker";
import type { Job } from "../../db/schema/jobs";
import { logger } from "../../src/utils/logger";
import { sendEvent } from "../../src/utils/event-client";
import { db } from "../../src/db";
import { killmails, victims, attackers, characters, corporations, alliances, types, groups, solarSystems, regions } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * WebSocket Emitter Worker
 *
 * Emits killmail events to the WebSocket server for real-time updates.
 *
 * This worker:
 * 1. Fetches complete killmail data from database
 * 2. Builds the display format with all related entities
 * 3. Sends the "killlist" event to the management API
 *
 * Decoupled from killmail fetching for better performance.
 */
export class WebSocketEmitter extends BaseWorker<{
  killmailId: number;
}> {
  override queueName = "websocket";
  override concurrency = 5; // Emit 5 events at once
  override pollInterval = 500; // Check every 500ms

  override async handle(
    payload: { killmailId: number },
    job: Job
  ) {
    const { killmailId } = payload;

    try {
      // Fetch complete killmail data for the update event
      const killmailDisplay = await this.getKillmailDisplay(killmailId);

      if (!killmailDisplay) {
        logger.warn(`  ↳ Could not build display data for killmail ${killmailId}`);
        return;
      }

      // Send killlist update event to management API
      await sendEvent("killlist", {
        killmail: killmailDisplay,
      });

    } catch (error) {
      logger.error(`❌ [WebSocket] Failed to emit event for killmail ${killmailId}:`, error);
      throw error;
    }
  }

  /**
   * Get complete killmail display data for broadcasting
   */
  private async getKillmailDisplay(killmailId: number): Promise<any> {
    try {
      // Fetch the internal killmail ID first
      const km = await db.query.killmails.findFirst({
        where: eq(killmails.killmailId, killmailId),
      });

      if (!km) return null;

      // Get victim data with related entities
      const result = await db
        .select()
        .from(victims)
        .leftJoin(characters, eq(victims.characterId, characters.characterId))
        .leftJoin(corporations, eq(victims.corporationId, corporations.corporationId))
        .leftJoin(alliances, eq(victims.allianceId, alliances.allianceId))
        .leftJoin(types, eq(victims.shipTypeId, types.typeId))
        .leftJoin(groups, eq(types.groupId, groups.groupId))
        .where(eq(victims.killmailId, km.id))
        .get();

      if (!result) return null;

      const vic = result.victims;
      const char = result.characters;
      const corp = result.corporations;
      const ally = result.alliances;
      const ship = result.types;
      const shipGroup = result.groups;

      // Get solar system info (separate query since relations may not be defined)
      const sys = await db.query.solarSystems.findFirst({
        where: eq(solarSystems.systemId, km.solarSystemId),
      });

      // Get region info if system exists
      let regionName = "Unknown";
      if (sys?.regionId) {
        const region = await db.query.regions.findFirst({
          where: eq(regions.regionId, sys.regionId),
        });
        regionName = region?.name || "Unknown";
      }

      // Get all attackers
      const attackerRows = await db
        .select({
          attacker: attackers,
          character: characters,
          corporation: corporations,
          alliance: alliances,
          ship: types,
          shipGroup: groups,
        })
        .from(attackers)
        .leftJoin(characters, eq(attackers.characterId, characters.characterId))
        .leftJoin(corporations, eq(attackers.corporationId, corporations.corporationId))
        .leftJoin(alliances, eq(attackers.allianceId, alliances.allianceId))
        .leftJoin(types, eq(attackers.shipTypeId, types.typeId))
        .leftJoin(groups, eq(types.groupId, groups.groupId))
        .where(eq(attackers.killmailId, km.id))
        .all();

      // Parse total value from killmail record (stored as text for precision)
      // This is the total value of the killmail (ship + fitted items + cargo)
      const totalValue = parseFloat(km.totalValue || "0") || 0;

      return {
        killmail_id: km.killmailId,
        killmail_hash: km.hash,
        killmail_time: km.killmailTime,
        ship_value: totalValue,
        attacker_count: attackerRows.length,
        victim: {
          character: { id: vic.characterId, name: char?.name || "Unknown" },
          corporation: { id: vic.corporationId, name: corp?.name || "Unknown" },
          alliance: { id: vic.allianceId, name: ally?.name || null },
          ship: {
            type_id: ship?.typeId || null,
            name: ship?.name || "Unknown",
            group: shipGroup?.name || "Unknown",
            group_id: shipGroup?.groupId || null,
          },
          damage_taken: vic.damageTaken || 0,
        },
        attackers: attackerRows
          .map((row) => ({
            character: { id: row.attacker.characterId, name: row.character?.name || "Unknown" },
            corporation: { id: row.attacker.corporationId, name: row.corporation?.name || "NPC" },
            alliance: { id: row.attacker.allianceId, name: row.alliance?.name || null },
            ship: { type_id: row.attacker.shipTypeId || null, name: row.ship?.name || "Unknown", group: row.shipGroup?.name || "Unknown" },
            weapon: { type_id: row.attacker.weaponTypeId || null, name: "Unknown" },
            damage_done: row.attacker.damageDone || 0,
            final_blow: row.attacker.finalBlow || false,
          }))
          .filter((a) => a), // Remove nulls
        solar_system: {
          id: sys?.systemId || null,
          name: sys?.name || "Unknown",
          region: regionName,
          region_id: sys?.regionId || null,
          security_status: parseFloat(sys?.securityStatus || "0") || 0,
        },
      };
    } catch (error) {
      logger.error(`Failed to get killmail display for ${killmailId}:`, error);
      return null;
    }
  }
}
