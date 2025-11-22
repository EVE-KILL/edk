import { purgeDatabase } from './purge';
import { migrateSchema } from '../../server/plugins/schema-migration';
import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

async function action() {
  logger.info('Resetting database...');
  try {
    await purgeDatabase();
    await migrateSchema();
    logger.success('✅ Database reset complete.');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database reset failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    await database.close();
  }
}

export default () => ({
  description: 'Purges the database and re-applies all migrations.',
  action,
});
