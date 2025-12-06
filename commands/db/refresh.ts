import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

/**
 * Get all materialized views from the database
 */
async function getMaterializedViews(): Promise<string[]> {
  const result = await database.query<{ matviewname: string }>(
    `SELECT matviewname
     FROM pg_matviews
     WHERE schemaname = 'public'
     ORDER BY matviewname`
  );
  return result.map((row) => row.matviewname);
}

/**
 * Refresh a single materialized view
 */
async function refreshView(viewName: string): Promise<void> {
  logger.info(`Refreshing materialized view: ${viewName}`);
  const startTime = Date.now();

  // Check if view is populated
  const status = await database.findOne<{ ispopulated: boolean }>(
    `SELECT ispopulated FROM pg_matviews WHERE matviewname = :viewName AND schemaname = 'public'`,
    { viewName }
  );

  if (status?.ispopulated) {
    await database.execute(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY ${database.identifier(viewName)}`
    );
  } else {
    logger.warn(
      `View '${viewName}' is not populated. Running non-concurrent refresh (this may lock the view)...`
    );
    await database.execute(
      `REFRESH MATERIALIZED VIEW ${database.identifier(viewName)}`
    );
  }

  const duration = Date.now() - startTime;
  logger.success(
    `Successfully refreshed materialized view: ${viewName} (${duration}ms)`
  );
}

/**
 * Main action - refresh specified view(s) or all views
 */
async function action(
  viewName?: string,
  options?: { list?: boolean; exclude?: string }
) {
  try {
    // Get all materialized views from database
    const allViews = await getMaterializedViews();

    if (allViews.length === 0) {
      logger.warn('No materialized views found in database.');
      process.exit(0);
    }

    // Handle --list option
    if (options?.list) {
      logger.info('Materialized views in database:');
      allViews.forEach((view) => logger.info(`  - ${view}`));
      process.exit(0);
    }

    // Refresh specific view if provided
    if (viewName) {
      if (!allViews.includes(viewName)) {
        logger.error(`❌ Materialized view '${viewName}' not found.`);
        logger.info('Available views:');
        allViews.forEach((view) => logger.info(`  - ${view}`));
        process.exit(1);
      }

      await refreshView(viewName);
      logger.success(`✅ Materialized view '${viewName}' refreshed.`);
      process.exit(0);
    }

    // Filter excluded views
    const excluded = options?.exclude ? options.exclude.split(',') : [];
    const viewsToRefresh = allViews.filter((v) => !excluded.includes(v));

    if (excluded.length > 0) {
      logger.info(`Skipping views: ${excluded.join(', ')}`);
    }

    // Refresh all views
    logger.info(`Refreshing ${viewsToRefresh.length} materialized views...`);
    for (const view of viewsToRefresh) {
      await refreshView(view);
    }
    logger.success(
      `✅ All ${viewsToRefresh.length} materialized views refreshed successfully.`
    );
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
    'Refreshes materialized views. Run without args to refresh all, or specify a view name.',
  options: [
    {
      flags: '--list',
      description: 'List all materialized views in the database',
    },
    {
      flags: '--exclude <views>',
      description: 'Comma-separated list of views to exclude from refresh',
    },
  ],
  arguments: [
    {
      name: '[viewName]',
      description: 'Optional: specific materialized view to refresh',
    },
  ],
  action,
});
