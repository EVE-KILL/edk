import { getWarsToUpdate } from '../server/models/wars';
import {
  enqueueJobMany,
  JobPriority,
  QueueType,
} from '../server/helpers/queue';
import { logger } from '../server/helpers/logger';

export const name = 'update-active-wars';
export const schedule = '0 30 * * * *'; // Every hour at :30
export const description =
  'Update active wars and recently finished wars (3 days) by enqueueing them to the war queue.';

const BATCH_SIZE = 100; // Enqueue in batches to avoid overwhelming queue

export const action = async () => {
  logger.info('[war-update] Starting active wars update');

  const warIds = await getWarsToUpdate(3, 60); // 3 days post-finish, 60 min interval

  if (warIds.length === 0) {
    logger.info('[war-update] No wars need updating');
    return;
  }

  logger.info(`[war-update] Found ${warIds.length} wars to update`);

  // Enqueue in batches
  for (let i = 0; i < warIds.length; i += BATCH_SIZE) {
    const batch = warIds.slice(i, i + BATCH_SIZE);
    await enqueueJobMany(
      QueueType.WAR,
      batch.map((warId) => ({ warId })),
      { priority: JobPriority.NORMAL }
    );
    logger.info(
      `[war-update] Enqueued batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} wars)`
    );
  }

  logger.success(
    `[war-update] Completed: enqueued ${warIds.length} wars for update`
  );
};
