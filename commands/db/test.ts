import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

/**
 * EDK Database Test Command
 *
 * Test database connectivity and optionally execute custom queries
 *
 * Usage:
 *   bun cli db:test                              # Test basic connectivity
 *   bun cli db:test --query "SELECT 1"           # Execute custom query
 *   bun cli db:test --query "SELECT * FROM killmails LIMIT 5" --json  # Output as JSON
 */
export default {
  description: 'Test database connection and execute queries',

  options: [
    {
      flags: '-q, --query <sql>',
      description: 'Execute a custom SQL query',
    },
    {
      flags: '-j, --json',
      description: 'Output results as JSON',
    },
    {
      flags: '-c, --count',
      description: 'Show row count only',
    },
  ],

  action: async (options: any) => {
    try {
      // Test basic connectivity
      logger.info('Testing database connection...');
      const pingResult = await database.ping();

      if (!pingResult) {
        logger.error('❌ Database connection failed');
        process.exit(1);
      }

      logger.success('✅ Database connection successful');

      // If custom query provided, execute it
      if (options.query) {
        logger.info('Executing query...', { query: options.query });

        const startTime = Date.now();
        const results = await database.query(options.query);
        const duration = Date.now() - startTime;

        if (options.count) {
          // Just show count
          process.stdout.write(`\nRows returned: ${results.length}\n`);
          process.stdout.write(`Query time: ${duration}ms\n`);
        } else if (options.json) {
          // JSON output
          process.stdout.write(JSON.stringify(results, null, 2) + '\n');
          process.stdout.write(`\n${results.length} rows in ${duration}ms\n`);
        } else {
          // Pretty table output
          if (results.length === 0) {
            process.stdout.write('\n(0 rows)\n\n');
          } else {
            process.stdout.write('\nResults:\n');
            // eslint-disable-next-line no-console
            console.table(results);
            process.stdout.write(
              `\n${results.length} rows in ${duration}ms\n\n`
            );
          }
        }

        logger.success('Query executed successfully');
      } else {
        // Show basic database info
        const dbInfo = await getDatabaseInfo();

        process.stdout.write('\nDatabase Information:\n');
        process.stdout.write('━'.repeat(60) + '\n');
        process.stdout.write(`Database:     ${dbInfo.name}\n`);
        process.stdout.write(`Size:         ${dbInfo.size}\n`);
        process.stdout.write(`Version:      ${dbInfo.version}\n`);
        process.stdout.write(`Connections:  ${dbInfo.connections}\n`);
        process.stdout.write(
          `Killmails:    ${dbInfo.killmailCount.toLocaleString()}\n`
        );
        process.stdout.write('━'.repeat(60) + '\n');
        process.stdout.write('\n');
      }

      process.exit(0);
    } catch (error) {
      logger.error('Database test failed', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  },
};

async function getDatabaseInfo() {
  const [name, size, version, connections, killmails] = await Promise.all([
    database.query<{ current_database: string }>('SELECT current_database()'),
    database.query<{ size: string }>(
      'SELECT pg_size_pretty(pg_database_size(current_database())) as size'
    ),
    database.query<{ version: string }>('SELECT version()'),
    database.query<{ count: string }>(
      'SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()'
    ),
    database.query<{ count: string }>(
      "SELECT reltuples::bigint as count FROM pg_class WHERE relname = 'killmails'"
    ),
  ]);

  return {
    name: name[0]?.current_database || 'unknown',
    size: size[0]?.size || 'unknown',
    version: version[0]?.version?.split(' ')[1] || 'unknown',
    connections: connections[0]?.count || '0',
    killmailCount: Number(killmails[0]?.count) || 0,
  };
}
