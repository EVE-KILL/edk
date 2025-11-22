import { migrateSchema } from '../../server/plugins/schema-migration';
import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

async function action() {
  logger.info('Running database migrations...');
  try {
    await migrateSchema();
    logger.info('Migrations completed successfully.');
  } catch (error) {
    logger.error('Migration failed:', { error });
    process.exit(1);
  } finally {
    await database.close();
    process.exit(0);
  }
}

export default () => ({
  description: 'Applies all pending database migrations.',
  action,
});
