import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';
import { createMissingPartitions } from '../../server/helpers/partitions';

async function action() {
  try {
    logger.info(
      'Maintaining partitions (yearly + rolling 6 months monthly)...'
    );
    const results = await createMissingPartitions();

    logger.info('Creation results:');
    logger.success(`  ✓ monthly partitions created: ${results.monthlyCreated}`);
    logger.success(
      `  ✓ yearly/rollup partitions created: ${results.yearlyCreated}`
    );
    logger.success(
      `  ✓ pre-window partitions created: ${results.partialCreated}`
    );
    logger.success(`  ✓ prices (yearly) created: ${results.pricesCreated}`);
    logger.success(
      `  ✓ pre-window partitions merged into yearly: ${results.preWindowsMerged}`
    );

    logger.info('Rollup results:');
    logger.success(`  ✓ monthly partitions rolled up: ${results.rolledUp}`);
    logger.success(`  ✓ monthly partitions dropped: ${results.droppedMonthly}`);

    if (results.skippedMonthly.length) {
      logger.warn(
        'Skipped monthly partitions (conflicts with existing yearly partitions):'
      );
      for (const skip of results.skippedMonthly) {
        logger.warn(`  - ${skip.table}: ${skip.partition} (${skip.reason})`);
      }
    }

    logger.success('✅ Partition maintenance completed successfully.');
  } catch (error) {
    logger.error('❌ Failed to create partitions.', { error });
    process.exit(1);
  } finally {
    await database.close();
    process.exit(0);
  }
}

export default () => ({
  description:
    'Creates missing partitions for killmails, attackers, and items tables from Dec 2007 to current + 3 months',
  action,
});
