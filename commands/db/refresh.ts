import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

// Note: kill_list is now a regular view (not materialized) as of the latest migration
// Only refresh materialized views here
const materializedViews = [
  'top_characters_weekly',
  'top_corporations_weekly',
  'top_alliances_weekly',
  'top_systems_weekly',
  'top_regions_weekly',
  'celestials',
];

async function refreshView(viewName: string) {
  logger.info(`Refreshing materialized view: ${viewName}`);
  await database.sql`REFRESH MATERIALIZED VIEW CONCURRENTLY ${database.sql(viewName)};`;
  logger.info(`Successfully refreshed materialized view: ${viewName}`);
}

async function action() {
  try {
    for (const view of materializedViews) {
      await refreshView(view);
    }
    logger.success('✅ All materialized views refreshed.');
  } catch (error) {
    logger.error('❌ Failed to refresh materialized views.', { error });
    process.exit(1);
  } finally {
    await database.sql.end();
  }
}

export default () => ({
  description:
    'Refreshes all materialized views (top_* weekly, celestials). Note: kill_list is now a regular view.',
  action,
});
