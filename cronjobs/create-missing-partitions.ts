import { createMissingPartitions } from '../server/helpers/partitions';

import { logger } from '../server/helpers/logger';

export const name = 'create-missing-partitions';
export const description =
  'Maintains partitions: yearly archive plus rolling 6 months of monthly partitions (and prices yearly)';
export const schedule = '0 0 2 * * *'; // Run daily at 2 AM UTC

export const action = async () => {
  try {
    logger.info(
      'Checking and maintaining partitions (yearly + monthly window)...'
    );

    const results = await createMissingPartitions();

    logger.success(`✓ monthly partitions created: ${results.monthlyCreated}`);
    logger.success(
      `✓ yearly/rollup partitions created: ${results.yearlyCreated}`
    );
    logger.success(
      `✓ pre-window partitions created: ${results.partialCreated}`
    );
    logger.success(`✓ prices (yearly) created: ${results.pricesCreated}`);
    logger.success(
      `✓ pre-window partitions merged into yearly: ${results.preWindowsMerged}`
    );
    logger.success(`✓ monthly partitions rolled up: ${results.rolledUp}`);
    logger.success(`✓ monthly partitions dropped: ${results.droppedMonthly}`);

    if (results.skippedMonthly.length) {
      logger.warn(
        'Skipped monthly partitions (conflicts with existing yearly partitions):'
      );
      for (const skip of results.skippedMonthly) {
        logger.warn(`- ${skip.table}: ${skip.partition} (${skip.reason})`);
      }
    }

    logger.success('Partition maintenance completed successfully.');
  } catch (error) {
    logger.error(
      `Failed to create missing partitions: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};
