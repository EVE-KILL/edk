import { BaseWorker } from "./base-worker";
import type { Job } from "../schema/jobs";
import { Killmails } from "../../models";
import { logger } from "../../utils/logger";
import { queue } from "../index";

/**
 * Killmail Processor Worker
 *
 * Processes incoming killmails from zkillboard websocket:
 * - Validates killmail data
 * - Checks for duplicates
 * - Parses and normalizes data
 * - Inserts into database
 * - Enqueues follow-up jobs (ESI fetches for all related entities)
 */
export class KillmailProcessor extends BaseWorker<{
  killmailId: number;
  hash: string;
  data: any; // Raw zkillboard data
}> {
  override queueName = "killmails";
  override concurrency = 5; // Process 5 killmails at once
  override pollInterval = 1000; // Check every second

  override async handle(payload: { killmailId: number; hash: string; data: any }, job: Job) {
    const { killmailId, hash, data } = payload;

    // Check if already exists
    const exists = await Killmails.existsByKillmailId(killmailId);
    if (exists) {
      logger.debug(`  ↳ Killmail ${killmailId} already exists, skipping`);
      return;
    }

    // Parse and validate killmail data
    const killmail = this.parseKillmail(data);

    // Insert into database
    await Killmails.create({
      killmailId,
      hash,
      ...killmail,
    });

    logger.debug(
      `  ↳ Inserted killmail ${killmailId} (${killmail.totalValue.toLocaleString()} ISK, ${killmail.attackerCount} attackers)`
    );

    // Enqueue ESI fetch jobs for all related entities
    await this.enqueueESIFetches(data);
  }

  /**
   * Enqueue ESI fetch jobs for all entities in the killmail
   */
  private async enqueueESIFetches(data: any) {
    const idsToFetch = new Set<string>();

    // Solar system
    if (data.solar_system_id) {
      idsToFetch.add(`system:${data.solar_system_id}`);
    }

    // Victim
    if (data.victim) {
      if (data.victim.character_id) {
        idsToFetch.add(`character:${data.victim.character_id}`);
      }
      if (data.victim.corporation_id) {
        idsToFetch.add(`corporation:${data.victim.corporation_id}`);
      }
      if (data.victim.alliance_id) {
        idsToFetch.add(`alliance:${data.victim.alliance_id}`);
      }
      if (data.victim.ship_type_id) {
        idsToFetch.add(`type:${data.victim.ship_type_id}`);
      }
    }

    // Attackers
    for (const attacker of data.attackers || []) {
      if (attacker.character_id) {
        idsToFetch.add(`character:${attacker.character_id}`);
      }
      if (attacker.corporation_id) {
        idsToFetch.add(`corporation:${attacker.corporation_id}`);
      }
      if (attacker.alliance_id) {
        idsToFetch.add(`alliance:${attacker.alliance_id}`);
      }
      if (attacker.ship_type_id) {
        idsToFetch.add(`type:${attacker.ship_type_id}`);
      }
      if (attacker.weapon_type_id) {
        idsToFetch.add(`type:${attacker.weapon_type_id}`);
      }
    }

    // Items
    for (const item of data.victim?.items || []) {
      if (item.item_type_id) {
        idsToFetch.add(`type:${item.item_type_id}`);
      }
    }

    // Enqueue all ESI jobs
    for (const id of idsToFetch) {
      const [type, idStr] = id.split(":");
      if (!type || !idStr) continue;

      await queue.dispatch("esi", type, {
        type: type as "character" | "corporation" | "alliance" | "type" | "system",
        id: Number.parseInt(idStr),
      });
    }

    logger.debug(`  ↳ Enqueued ${idsToFetch.size} ESI fetch jobs`);
  }

  /**
   * Parse and normalize zkillboard data into our schema
   */
  private parseKillmail(data: any) {
    // Calculate if solo kill (1 attacker, not NPC)
    const attackers = data.attackers || [];
    const isSolo = attackers.length === 1 && !attackers[0].faction_id;

    // Check if NPC kill
    const isNpc = attackers.every((a: any) => a.faction_id || a.ship_type_id === 670);

    return {
      killmailTime: new Date(data.killmail_time),
      solarSystemId: data.solar_system_id,
      victim: data.victim,
      attackers: attackers,
      items: data.victim?.items || [],
      totalValue: data.zkb?.totalValue || 0,
      attackerCount: attackers.length,
      points: data.zkb?.points || 0,
      isSolo,
      isNpc,
    };
  }
}
