import { Worker, Job } from 'bullmq';
import { fetchAndStoreCharacter } from '../server/fetchers/character';
import { logger } from '../server/helpers/logger';

/**
 * Character Queue Processor
 *
 * Processes character entity update jobs
 * Fetches character data from EVE-KILL/ESI and stores it
 */

export const name = 'character';

export async function processor(job: Job): Promise<void> {
  const { id } = job.data as { id: number };

  logger.info(`[character] Processing character ${id}...`);

  try {
    const result = await fetchAndStoreCharacter(id);

    if (result) {
      logger.success(`✅ [character] Successfully processed character ${id}`);
    } else {
      logger.warn(
        `⚠️  [character] Character ${id} not found or failed to fetch`
      );
    }
  } catch (error) {
    logger.error(`❌ [character] Error processing character ${id}:`, error);
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
