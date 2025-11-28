import { logger } from '../../server/helpers/logger';
import { refreshWarStats } from '../../server/models/war-stats';
import { database } from '../../server/helpers/database';

async function action() {
  try {
    logger.info('Refreshing war statistics materialized views...');
    const startTime = Date.now();

    await refreshWarStats();

    const duration = Date.now() - startTime;
    logger.success(
      `✅ War statistics materialized views refreshed successfully in ${duration}ms`
    );
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to refresh war statistics materialized views', {
      error,
    });
    process.exit(1);
  } finally {
    await database.close();
  }
}

export default () => ({
  description:
    'Refreshes war statistics materialized views (war_stats, war_participants, war_ship_classes).',
  action,
});
