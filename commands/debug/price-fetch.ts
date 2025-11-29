/**
 * Test Price Fetching
 *
 * Enqueues a job to fetch prices for a specific type
 */

import { QueueType, enqueueJob } from '../../server/helpers/queue';
import { logger } from '../../server/helpers/logger';

export const description = 'Test price fetching by enqueuing a price job';

export const options = {
  typeId: {
    description: 'Type ID to fetch prices for (default: 32305 - Chemosh)',
    default: 32305,
  },
  date: {
    description: 'Optional Unix timestamp for historical prices',
  },
};

export async function action(options: { typeId: number; date?: number }) {
  logger.info('[Test] Enqueuing price fetch job', options);

  try {
    await enqueueJob(QueueType.PRICE, {
      typeId: options.typeId,
      date: options.date,
    });

    logger.success(`[Test] Price job enqueued for type ${options.typeId}`);
    logger.info(
      '[Test] Make sure the price queue worker is running: bun queue price'
    );
  } catch (error) {
    logger.error('[Test] Error enqueuing price job:', { error });
    process.exit(1);
  }

  process.exit(0);
}
