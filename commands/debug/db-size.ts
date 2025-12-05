import chalk from 'chalk';
import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

export default {
  description: 'Analyze detailed database size breakdown',
  action: async () => {
    logger.info('Analyzing database size usage...');

    const query = `
      SELECT
        relname as table_name,
        pg_size_pretty(pg_total_relation_size(C.oid)) as total_size,
        pg_size_pretty(pg_relation_size(C.oid)) as heap_size,
        pg_size_pretty(pg_total_relation_size(C.oid) - pg_relation_size(C.oid)) as index_size,
        reltuples::bigint as row_estimate
      FROM pg_class C
      LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace)
      WHERE nspname = 'public'
      AND C.relkind IN ('r', 'p') -- tables and partitions
      AND pg_total_relation_size(C.oid) > 1024 * 1024 -- > 1MB
      ORDER BY pg_total_relation_size(C.oid) DESC
      LIMIT 20;
    `;

    const rows = await database.query<any>(query);

    console.table(rows);

    // Also check index usage explicitly
    const indexQuery = `
      SELECT
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(indexname))) as index_size
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY pg_relation_size(quote_ident(schemaname) || '.' || quote_ident(indexname)) DESC
      LIMIT 10;
    `;

    logger.info('Top 10 Largest Indexes:');
    const indexRows = await database.query<any>(indexQuery);
    console.table(indexRows);

    process.exit(0);
  },
};
