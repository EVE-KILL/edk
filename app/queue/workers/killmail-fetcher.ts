import { BaseWorker } from "./base-worker";
import type { Job } from "../schema/jobs";
import { logger } from "../../../src/utils/logger";
import { KillmailService } from "../../services/esi/killmail-service";
import { queue } from "../index";

/**
 * Killmail Fetcher Worker
 *
 * Fetches killmail data from ESI using killmailId and hash:
 * - Fetches from ESI /killmails/{id}/{hash}/
 * - Stores in database
 * - Enqueues processor job to fetch related entities
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
      // Fetch from ESI (getKillmail will check database first)
      const killmail = await this.killmailService.getKillmail(killmailId, hash);

      if (!killmail) {
        logger.debug(`  ↳ Killmail ${killmailId} not found`);
        return;
      }

      logger.debug(`  ↳ Fetched killmail ${killmailId}`);

      // Enqueue processor job to fetch all related entities
      await this.enqueueESIFetches(killmail);
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
    if (data.solarSystemId) {
      idsToFetch.add(`system:${data.solarSystemId}`);
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

    // Enqueue all ESI jobs
    for (const id of idsToFetch) {
      const [type, idStr] = id.split(":");
      if (!type || !idStr) continue;

      await queue.dispatch("esi", type, {
        type: type as "character" | "corporation" | "alliance" | "type" | "system",
        id: Number.parseInt(idStr),
      });
    }

    logger.debug(`  ↳ Enqueued ${idsToFetch.size} ESI fetch jobs for killmail`);
  }
}
