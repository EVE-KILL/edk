import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

export const description = 'Analyze database tables to update statistics';

export async function action() {
  const sql = database.sql;

  try {
    logger.info('Starting database analysis...');

    // Get all tables from database dynamically
    const tablesResult = await sql<Array<{ tablename: string }>>` 
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;

    const tables = tablesResult.map((t) => t.tablename);
    logger.info(`Found ${tables.length} tables to analyze`);

    const startTime = performance.now();

    for (const table of tables) {
      const tableStart = performance.now();
      logger.info(`Analyzing table: ${table}...`);

      await sql`ANALYZE ${sql(table)}`;

      const elapsed = (performance.now() - tableStart).toFixed(2);
      logger.success(`✓ ${table} analyzed in ${elapsed}ms`);
    }

    const totalTime = (performance.now() - startTime).toFixed(2);
    logger.success(`Database analysis complete in ${totalTime}ms`);

    // Show updated statistics
    logger.info('Updated statistics:');
    const stats = await sql`
      SELECT 
        relname as table_name,
        n_live_tup as rows
      FROM pg_stat_user_tables 
      WHERE relname = ANY(${sql.array(tables)})
      ORDER BY n_live_tup DESC
    `;

    for (const stat of stats) {
      logger.info(
        `  ${stat.table_name}: ${Number(stat.rows).toLocaleString()} rows`
      );
    }

    process.exit(0);
  } catch (error) {
    logger.error('Failed to analyze database', { error });
    process.exit(1);
  }
}
