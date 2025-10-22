import { BaseWorker } from "../../src/queue/base-worker";
import type { Job } from "../../db/schema/jobs";
import { logger } from "../../src/utils/logger";
import { KillmailService } from "../services/esi/killmail-service";
import { queue } from "../../src/queue/job-dispatcher";
import { sendEvent } from "../../src/utils/event-client";
import { db } from "../../src/db";
import { killmails, victims, attackers, characters, corporations, alliances, types, solarSystems, regions } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Killmail Fetcher Worker
 *
 * Fetches killmail data from ESI using killmailId and hash:
 * - Fetches from ESI /killmails/{id}/{hash}/
 * - Stores in database
 * - Enqueues price fetch and ESI entity fetch jobs
 */
export class KillmailFetcher extends BaseWorker<{
  killmailId: number;
  hash: string;
}> {
  override queueName = "killmail-fetch";
  override concurrency = 5; // Fetch 5 killmails at once
  override pollInterval = 1000;

  private killmailService = new KillmailService();

  override async handle(payload: { killmailId: number; hash: string }, job: Job) {
    const { killmailId, hash } = payload;

    try {
      // Fetch from ESI and save to database
      const killmail = await this.killmailService.getKillmail(killmailId, hash);

      if (!killmail) {
        logger.debug(`  ↳ Killmail ${killmailId} not found`);
        return;
      }

      logger.debug(`  ↳ Fetched and saved killmail ${killmailId}`);

      // Enqueue ESI fetch jobs for all related entities
      await this.enqueueESIFetches(killmail);

      // Fetch complete killmail data for the update event
      const killmailDisplay = await this.getKillmailDisplay(killmailId);
      if (killmailDisplay) {
        // Send killlist update event to management API
        await sendEvent("killlist", {
          killmail: killmailDisplay,
        });
      }
    } catch (error) {
      logger.error(`  ↳ Failed to fetch killmail ${killmailId}:`, error);
      throw error;
    }
  }

  /**
   * Enqueue ESI fetch jobs for all entities in the killmail
   */
  private async enqueueESIFetches(data: any) {
    const idsToFetch = new Set<string>();

    // Solar system
    if (data.killmail.solarSystemId) {
      idsToFetch.add(`system:${data.killmail.solarSystemId}`);
    }

    // Victim
    if (data.victim) {
      if (data.victim.characterId) {
        idsToFetch.add(`character:${data.victim.characterId}`);
      }
      if (data.victim.corporationId) {
        idsToFetch.add(`corporation:${data.victim.corporationId}`);
      }
      if (data.victim.allianceId) {
        idsToFetch.add(`alliance:${data.victim.allianceId}`);
      }
      if (data.victim.shipTypeId) {
        idsToFetch.add(`type:${data.victim.shipTypeId}`);
      }
    }

    // Attackers
    for (const attacker of data.attackers || []) {
      if (attacker.characterId) {
        idsToFetch.add(`character:${attacker.characterId}`);
      }
      if (attacker.corporationId) {
        idsToFetch.add(`corporation:${attacker.corporationId}`);
      }
      if (attacker.allianceId) {
        idsToFetch.add(`alliance:${attacker.allianceId}`);
      }
      if (attacker.shipTypeId) {
        idsToFetch.add(`type:${attacker.shipTypeId}`);
      }
      if (attacker.weaponTypeId) {
        idsToFetch.add(`type:${attacker.weaponTypeId}`);
      }
    }

    // Items
    for (const item of data.items || []) {
      if (item.itemTypeId) {
        idsToFetch.add(`type:${item.itemTypeId}`);
      }
    }

    // Enqueue all ESI jobs with HIGH priority
    for (const id of idsToFetch) {
      const [type, idStr] = id.split(":");
      if (!type || !idStr) continue;

      await queue.dispatch("esi", type, {
        type: type as "character" | "corporation" | "alliance" | "type" | "system",
        id: Number.parseInt(idStr),
      }, {
        priority: 0, // Highest priority - process data for new killmails first
      });
    }

    logger.debug(`  ↳ Enqueued ${idsToFetch.size} ESI fetch jobs for killmail`);
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
        .where(eq(victims.killmailId, km.id))
        .get();

      if (!result) return null;

      const vic = result.victims;
      const char = result.characters;
      const corp = result.corporations;
      const ally = result.alliances;
      const ship = result.types;

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
        .select()
        .from(attackers)
        .leftJoin(characters, eq(attackers.characterId, characters.characterId))
        .leftJoin(corporations, eq(attackers.corporationId, corporations.corporationId))
        .leftJoin(alliances, eq(attackers.allianceId, alliances.allianceId))
        .where(eq(attackers.killmailId, km.id))
        .all();

      // Parse ship value from killmail record (stored as text for precision)
      const shipPrice = parseInt(km.shipValue || "0", 10) || 0;

      return {
        killmail_id: km.killmailId,
        killmail_time: km.killmailTime,
        ship_value: shipPrice,
        victim: {
          character: { id: char?.characterId || null, name: char?.name || "Unknown" },
          corporation: { id: corp?.corporationId || 0, name: corp?.name || "Unknown" },
          alliance: { id: ally?.allianceId || null, name: ally?.name || null },
          ship: { type_id: ship?.typeId || 0, name: ship?.name || "Unknown", group: ship?.groupId?.toString() || "" },
          damage_taken: vic.damageTaken || 0,
        },
        attackers: attackerRows
          .map((row) => ({
            character: { id: row.characters?.characterId || null, name: row.characters?.name || "Unknown" },
            corporation: { id: row.corporations?.corporationId || null, name: row.corporations?.name || "NPC" },
            alliance: { id: row.alliances?.allianceId || null, name: row.alliances?.name || null },
            ship: { type_id: row.attackers.shipTypeId || null, name: "Unknown" },
            weapon: { type_id: row.attackers.weaponTypeId || null, name: "Unknown" },
            damage_done: row.attackers.damageDone || 0,
            final_blow: row.attackers.finalBlow || false,
          }))
          .filter((a) => a), // Remove nulls
        solar_system: {
          id: sys?.systemId || 0,
          name: sys?.name || "Unknown",
          region: regionName,
          security_status: parseFloat(sys?.securityStatus || "0") || 0,
        },
      };
    } catch (error) {
      logger.error(`Failed to get killmail display for ${killmailId}:`, error);
      return null;
    }
  }
}
