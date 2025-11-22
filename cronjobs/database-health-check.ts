/**
 * Database Health Check Cron Job
 *
 * Periodically checks database connection and logs table statistics
 */

import { database } from '../server/helpers/database';
import { logger } from '../server/helpers/logger';

export const name = 'database-health-check';
export const description = 'Check database connection and log table statistics';

// Run every hour at minute 0
// Format: seconds minutes hours day month dayOfWeek
export const schedule = '0 0 * * * *';

export async function action() {
  logger.info('[Health Check] Starting database health check');

  try {
    // Check connection
    const connected = await database.ping();

    if (!connected) {
      logger.error('[Health Check] ❌ Database connection failed');
      return;
    }

    logger.success('[Health Check] ✓ Database connection OK');

    // Get table counts (estimates)
    const tables = await database.find<{ name: string; total_rows: number }>(
      `SELECT
         relname as name,
         n_live_tup as "total_rows"
       FROM pg_stat_user_tables
       ORDER BY n_live_tup DESC`
    );

    logger.info('[Health Check] Table statistics:');
    for (const table of tables) {
      logger.info(`  ${table.name}: ${table.total_rows.toLocaleString()} rows`);
    }

    logger.success('[Health Check] Health check completed');
  } catch (error) {
    logger.error('[Health Check] Health check failed:', { error });
  }
}
