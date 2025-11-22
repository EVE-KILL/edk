import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

async function action() {
  logger.info('Refreshing materialized view: celestials');

  try {
    await database.execute(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY celestials'
    );
    logger.info('Successfully refreshed materialized view: celestials');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to refresh materialized view: celestials', { error });
    process.exit(1);
  } finally {
    await database.close();
  }
}

export default () => ({
  description: 'Refreshes the celestials materialized view.',
  action,
});
