import { BaseWorker } from "./base-worker";
import type { Job } from "../schema/jobs";
import { Killmails } from "../../models";
import { logger } from "../../utils/logger";

/**
 * Killmail Processor Worker
 *
 * Processes incoming killmails from zkillboard websocket:
 * - Validates killmail data
 * - Checks for duplicates
 * - Parses and normalizes data
 * - Inserts into database
 * - Optionally enqueues follow-up jobs (ESI fetches, stats updates)
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

    // TODO: Enqueue follow-up jobs
    // - Fetch character/corp/alliance names from ESI
    // - Update statistics
    // - Send notifications
    // - Update search index
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
