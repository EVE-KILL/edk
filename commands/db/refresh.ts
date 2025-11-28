import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

// Only refresh materialized views (kill_list view has been removed)
const materializedViews = [
  'top_characters_weekly',
  'top_corporations_weekly',
  'top_alliances_weekly',
  'top_systems_weekly',
  'top_regions_weekly',
  'celestials',
  'war_stats',
  'war_participants',
  'war_ship_classes',
  'war_most_valuable_kills',
];

async function refreshView(viewName: string) {
  logger.info(`Refreshing materialized view: ${viewName}`);
  await database.execute(
    `REFRESH MATERIALIZED VIEW CONCURRENTLY ${database.identifier(viewName)}`
  );
  logger.info(`Successfully refreshed materialized view: ${viewName}`);
}

async function action() {
  try {
    for (const view of materializedViews) {
      await refreshView(view);
    }
    logger.success('✅ All materialized views refreshed.');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to refresh materialized views.', { error });
    process.exit(1);
  } finally {
    await database.close();
  }
}

export default () => ({
  description:
    'Refreshes all materialized views (top_* weekly, celestials, war_*).',
  action,
});
