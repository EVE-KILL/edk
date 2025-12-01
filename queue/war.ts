import { Worker, Job } from 'bullmq';
import { ingestWar } from '../server/fetchers/war';
import { logger } from '../server/helpers/logger';

/**
 * War Queue Processor
 *
 * Processes war update jobs
 * Fetches war details and killmails from ESI, updates database
 */

export const name = 'war';

export async function processor(job: Job): Promise<void> {
  const { warId } = job.data as { warId: number };

  logger.info(`[war-worker] Processing war ${warId}...`);

  try {
    const result = await ingestWar(warId);

    logger.success(
      `[war-worker] Successfully processed war ${warId} ` +
        `(queued ${result.queuedKillmails} killmails, ${result.alliesCount} allies)`
    );
  } catch (error) {
    logger.error(`[war-worker] Error processing war ${warId}:`, error);
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
    concurrency: options?.concurrency ?? 3, // Conservative for API calls
    lockDuration: 60000, // 60s lock (war ingestion can be slow)
    lockRenewTime: 30000, // Renew every 30s
    maxStalledCount: 2,
    stalledInterval: 10000,
    // Retry configuration
    settings: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000, // 5s, 25s, 125s
      },
    },
  });
}
