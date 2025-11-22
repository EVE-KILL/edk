import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

export async function purgeDatabase() {
  logger.warn('⚠️  Purging database! All data will be lost.');

  const tablesResult = await database.find<{ tableName: string }>(
    `SELECT table_name as "tableName"
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const tables = tablesResult.map((row) => row.tableName);

  for (const table of tables) {
    if (table !== 'spatial_ref_sys') {
      logger.info(`Dropping table: ${table}`);
      await database.execute(
        `DROP TABLE IF EXISTS ${database.identifier(table)} CASCADE`
      );
    }
  }

  const viewsResult = await database.find<{ viewName: string }>(
    `SELECT matviewname as "viewName"
     FROM pg_matviews
     WHERE schemaname = 'public'`
  );
  const views = viewsResult.map((row) => row.viewName);
  for (const view of views) {
    logger.info(`Dropping materialized view: ${view}`);
    await database.execute(
      `DROP MATERIALIZED VIEW IF EXISTS ${database.identifier(view)} CASCADE`
    );
  }

  const remainingTables = await database.find<{ tableName: string }>(
    `SELECT table_name as "tableName"
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
       AND table_name != 'spatial_ref_sys'`
  );
  const remainingViews = await database.find<{ viewName: string }>(
    `SELECT matviewname as "viewName"
     FROM pg_matviews
     WHERE schemaname = 'public'`
  );

  if (remainingTables.length === 0 && remainingViews.length === 0) {
    logger.success('✅ Database purged successfully.');
  } else {
    const remaining = [
      ...remainingTables.map((t) => t.tableName),
      ...remainingViews.map((v) => v.viewName),
    ];
    logger.warn(
      `⚠️  Database purged but some objects remain: ${remaining.join(', ')}`
    );
  }
}

async function action() {
  try {
    await purgeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database purge failed:', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    await database.close();
  }
}

export default () => ({
  description: 'Purge and reset the database (Use with caution!)',
  action,
});
