import { Worker, Job } from 'bullmq';
import { fetchAndStoreAlliance } from '../server/fetchers/alliance';
import { logger } from '../server/helpers/logger';

/**
 * Alliance Queue Processor
 *
 * Processes alliance entity update jobs
 * Fetches alliance data from EVE-KILL/ESI and stores it
 */

export const name = 'alliance';

export async function processor(job: Job): Promise<void> {
  const { id } = job.data as { id: number };

  logger.info(`[alliance] Processing alliance ${id}...`);

  try {
    const result = await fetchAndStoreAlliance(id);

    if (result) {
      logger.success(`✅ [alliance] Successfully processed alliance ${id}`);
    } else {
      logger.warn(`⚠️  [alliance] Alliance ${id} not found or failed to fetch`);
    }
  } catch (error) {
    logger.error(`❌ [alliance] Error processing alliance ${id}:`, error);
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
