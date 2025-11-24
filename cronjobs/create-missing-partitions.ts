import { createMissingPartitions } from '../server/helpers/partitions';

import { logger } from '../server/helpers/logger';

export const name = 'create-missing-partitions';
export const description =
  'Ensures partitions exist from Dec 2007 through current + 3 months for killmails, attackers, items, and prices tables';
export const schedule = '0 2 * * *'; // Run daily at 2 AM

export const action = async () => {
  try {
    logger.info('Checking and creating missing partitions...');

    const results = await createMissingPartitions();

    logger.success(`✓ killmails: ${results.killmails} partitions created`);
    logger.success(`✓ attackers: ${results.attackers} partitions created`);
    logger.success(`✓ items: ${results.items} partitions created`);
    logger.success(`✓ prices: ${results.prices} partitions created`);

    logger.success('Partition maintenance completed successfully.');
  } catch (error) {
    logger.error(
      `Failed to create missing partitions: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};
