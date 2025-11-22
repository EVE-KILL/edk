import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';
import { createMissingPartitions } from '../../server/helpers/partitions';

async function action() {
  try {
    logger.info('Creating missing partitions...');
    logger.info(
      'This will create partitions from December 2007 through current + 3 months'
    );
    logger.info('');

    const results = await createMissingPartitions();

    logger.info('Results:');
    logger.success(`  ✓ killmails: ${results.killmails} partitions created`);
    logger.success(`  ✓ attackers: ${results.attackers} partitions created`);
    logger.success(`  ✓ items: ${results.items} partitions created`);

    logger.info('');
    logger.success('✅ Partition creation completed successfully.');
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
