import { Worker, Job } from 'bullmq';
import {
  batchUpsertEntityStats,
  type EntityStatsUpdate,
} from '../server/models/entityStatsUpdate';
import { logger } from '../server/helpers/logger';

/**
 * Entity Stats Queue Processor
 *
 * Processes entity statistics update jobs for killmails.
 * Replaces the database trigger with queue-based processing.
 * This eliminates deadlocks and improves killmail insertion performance.
 */

export const name = 'entity_stats';

export async function processor(job: Job): Promise<void> {
  const { killmailId, killmailTime, entities, totalValue, isSolo, isNpc } =
    job.data as {
      killmailId: number;
      killmailTime: string;
      entities: EntityStatsUpdate[];
      totalValue: number;
      isSolo: boolean;
      isNpc: boolean;
    };

  logger.info(
    `[entity_stats] Processing stats for killmail ${killmailId} (${entities.length} entities)...`
  );

  try {
    const killmailDate = new Date(killmailTime);

    // Batch update all entity stats in a single transaction
    await batchUpsertEntityStats(
      entities,
      killmailDate,
      totalValue,
      isSolo,
      isNpc
    );

    logger.success(
      `✅ [entity_stats] Successfully updated stats for killmail ${killmailId}`
    );
  } catch (error) {
    logger.error(
      `❌ [entity_stats] Error processing stats for killmail ${killmailId}:`,
      error
    );
    throw error; // Re-throw for BullMQ retry handling
  }
}

/**
 * Create worker instance
 * Used by main queue.ts runner
 */
export function createWorker(
  connection: any,
  options?: { concurrency?: number }
) {
  return new Worker(name, processor, {
    connection,
    concurrency: options?.concurrency ?? 5,
    lockDuration: 30000,
    lockRenewTime: 15000,
    maxStalledCount: 2,
    stalledInterval: 5000,
  });
}
