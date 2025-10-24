import { BaseWorker } from "../../src/queue/base-worker";
import type { Job } from "../../db/schema/jobs";
import { logger } from "../../src/utils/logger";
import { KillmailService } from "../services/esi/killmail-service";
import { queue } from "../../src/queue/job-dispatcher";

/**
 * Killmail Fetcher Worker
 *
 * Fetches killmail data from ESI using killmailId and hash:
 * - Fetches from eve-kill.com/ESI
 * - Stores in database
 * - Enqueues ESI entity fetch jobs
 * - Enqueues websocket emission job
 */
export class KillmailFetcher extends BaseWorker<{
  killmailId: number;
  hash: string;
}> {
  override queueName = "killmail-fetch";
  override concurrency = 10; // Fetch 5 killmails at once
  override pollInterval = 500;

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

      // Enqueue ESI fetch jobs for all related entities
      await this.enqueueESIFetches(killmail);

      // Enqueue websocket emission job
      await queue.dispatch("websocket", "emit", {
        killmailId: killmailId,
      }, {
        priority: 5, // Normal priority
        skipIfExists: true,
      });
    } catch (error) {
      logger.error(`  ↳ Failed to fetch killmail ${killmailId}:`, error);
      throw error;
    }
  }

  /**
   * Enqueue ESI fetch jobs for all entities in the killmail
   *
   * Only enqueues dynamic data (characters, corporations, alliances).
   * Static data (types, systems, regions, etc.) is already imported at startup
   * and stored in the database, so no need to fetch on-demand.
   *
   * Optimized to batch all ESI jobs into a single database insert.
   */
  private async enqueueESIFetches(data: any) {
    const charactersToFetch = new Set<number>();
    const corporationsToFetch = new Set<number>();
    const alliancesToFetch = new Set<number>();

    // Victim
    if (data.victim) {
      if (data.victim.characterId) charactersToFetch.add(data.victim.characterId);
      if (data.victim.corporationId) corporationsToFetch.add(data.victim.corporationId);
      if (data.victim.allianceId) alliancesToFetch.add(data.victim.allianceId);
    }

    // Attackers
    for (const attacker of data.attackers || []) {
      if (attacker.characterId) charactersToFetch.add(attacker.characterId);
      if (attacker.corporationId) corporationsToFetch.add(attacker.corporationId);
      if (attacker.allianceId) alliancesToFetch.add(attacker.allianceId);
    }

    // Build payloads for batch dispatch
    const payloads: Array<{ type: "character" | "corporation" | "alliance"; id: number }> = [];

    for (const id of charactersToFetch) {
      payloads.push({ type: "character", id });
    }
    for (const id of corporationsToFetch) {
      payloads.push({ type: "corporation", id });
    }
    for (const id of alliancesToFetch) {
      payloads.push({ type: "alliance", id });
    }

    // Batch dispatch all ESI jobs in a single database operation
    if (payloads.length > 0) {
      await queue.dispatchMany("esi", "fetch", payloads, {
        priority: 0, // Highest priority - process data for new killmails first
      });

      logger.debug(`  ↳ Enqueued ${payloads.length} ESI fetch jobs (${charactersToFetch.size} chars, ${corporationsToFetch.size} corps, ${alliancesToFetch.size} alliances)`);
    }
  }
}
