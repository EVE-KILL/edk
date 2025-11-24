import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

export default {
  description: 'Run VACUUM operations on database tables',
  options: [
    {
      flags: '--full',
      description: 'Run VACUUM FULL (reclaims space, requires table lock)',
    },
    {
      flags: '--analyze',
      description: 'Run VACUUM ANALYZE (updates statistics)',
    },
    {
      flags: '--table <name>',
      description: 'Vacuum specific table (default: all large tables)',
    },
    {
      flags: '--verbose',
      description: 'Show detailed progress',
    },
  ],
  action: async (options: {
    full?: boolean;
    analyze?: boolean;
    table?: string;
    verbose?: boolean;
  }) => {
    const sql = database.sql;

    // Default tables to vacuum
    const defaultTables = [
      'characters',
      'corporations',
      'alliances',
      'prices',
    ];

    const tables = options.table ? [options.table] : defaultTables;

    // Build VACUUM command
    let vacuumCmd = 'VACUUM';
    if (options.full) {
      vacuumCmd += ' FULL';
      logger.warn('Running VACUUM FULL - this will lock tables!');
    }
    if (options.analyze) {
      vacuumCmd += ' ANALYZE';
    }
    if (options.verbose) {
      vacuumCmd += ' VERBOSE';
    }

    logger.info(`Running ${vacuumCmd} on ${tables.length} table(s)...`);

    const startTime = performance.now();
    let successCount = 0;
    let failCount = 0;

    for (const table of tables) {
      try {
        const tableStart = performance.now();
        logger.info(`${vacuumCmd} ${table}...`);

        // Use unsafe because VACUUM can't be in prepared statements
        await sql.unsafe(`${vacuumCmd} ${table}`);

        const duration = ((performance.now() - tableStart) / 1000).toFixed(2);
        logger.success(`✓ ${table} (${duration}s)`);
        successCount++;
      } catch (error) {
        logger.error(`✗ Failed to vacuum ${table}`, { error });
        failCount++;
      }
    }

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);

    logger.info('');
    logger.info('Vacuum Summary:');
    logger.info(`  Success: ${successCount}`);
    logger.info(`  Failed: ${failCount}`);
    logger.info(`  Total time: ${totalTime}s`);

    if (options.full) {
      logger.info('');
      logger.info('Check space savings:');
      logger.info(
        '  bun cli db:stats --table characters --table corporations'
      );
    }

    process.exit(failCount > 0 ? 1 : 0);
  },
};
