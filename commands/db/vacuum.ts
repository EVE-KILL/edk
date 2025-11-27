import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

interface TableSize {
  schemaname: string;
  tablename: string;
  size_bytes: number;
  size_pretty: string;
}

async function getTableSizes(sql: any): Promise<TableSize[]> {
  return await sql<TableSize[]>`
    SELECT 
      schemaname,
      tablename,
      pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size_pretty
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
  `;
}

async function vacuumTable(
  sql: any,
  tableName: string,
  options: { full?: boolean; analyze?: boolean; verbose?: boolean }
): Promise<{ success: boolean; duration: number; error?: any }> {
  const startTime = performance.now();

  let vacuumCmd = 'VACUUM';
  if (options.full) vacuumCmd += ' FULL';
  if (options.analyze) vacuumCmd += ' ANALYZE';
  if (options.verbose) vacuumCmd += ' VERBOSE';

  try {
    // Properly quote table name to handle mixed case identifiers
    const quotedTable = `"${tableName}"`;
    await sql.unsafe(`${vacuumCmd} ${quotedTable}`);
    return {
      success: true,
      duration: (performance.now() - startTime) / 1000,
    };
  } catch (error) {
    return {
      success: false,
      duration: (performance.now() - startTime) / 1000,
      error,
    };
  }
}

export default {
  description: 'Run VACUUM operations and database optimization',
  options: [
    {
      flags: '--full',
      description: 'Run VACUUM FULL (reclaims space, locks tables)',
    },
    {
      flags: '--analyze',
      description: 'Run VACUUM ANALYZE (updates statistics)',
    },
    {
      flags: '--all',
      description:
        'Include ALL tables including partitions (default with --full)',
    },
    {
      flags: '--non-partitions-only',
      description: 'Only vacuum non-partitioned tables (faster)',
    },
    {
      flags: '--old-partitions-only',
      description: 'Only vacuum partitions older than 6 months',
    },
    {
      flags: '--table <name>',
      description: 'Vacuum specific table or partition',
    },
    {
      flags: '--reindex',
      description: 'REINDEX tables after VACUUM FULL',
    },
    {
      flags: '--verbose',
      description: 'Show detailed progress',
    },
    {
      flags: '--dry-run',
      description: 'Show what would be vacuumed without doing it',
    },
  ],
  action: async (options: {
    full?: boolean;
    analyze?: boolean;
    all?: boolean;
    nonPartitionsOnly?: boolean;
    oldPartitionsOnly?: boolean;
    table?: string;
    reindex?: boolean;
    verbose?: boolean;
    dryRun?: boolean;
  }) => {
    const sql = database.sql;

    logger.info('=== DATABASE VACUUM & OPTIMIZATION ===\n');

    // Get database size before
    const dbSizeBefore = await sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size
    `;
    logger.info(`Database size before: ${dbSizeBefore[0].size}`);

    // Determine which tables to vacuum
    let tablesToVacuum: string[] = [];

    if (options.table) {
      tablesToVacuum = [options.table];
    } else {
      const allTables = await getTableSizes(sql);

      if (options.oldPartitionsOnly) {
        // Only old partitions (before 6 months ago)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const cutoffYear = sixMonthsAgo.getFullYear();
        const cutoffMonth = sixMonthsAgo.getMonth() + 1; // 1-12

        tablesToVacuum = allTables
          .filter((t) => {
            const match = t.tablename.match(
              /^(killmails|attackers|items)_(\d{4})(?:_(\d{2}))?$/
            );
            if (!match) return false;

            const year = parseInt(match[2]);
            const month = match[3] ? parseInt(match[3]) : 1;

            if (year < cutoffYear) return true;
            if (year === cutoffYear && month < cutoffMonth) return true;
            return false;
          })
          .map((t) => t.tablename);

        logger.info(
          `Found ${tablesToVacuum.length} partitions older than 6 months`
        );
      } else if (options.nonPartitionsOnly) {
        // Non-partitioned tables only
        tablesToVacuum = allTables
          .filter(
            (t) =>
              !t.tablename.startsWith('killmails') &&
              !t.tablename.startsWith('attackers') &&
              !t.tablename.startsWith('items')
          )
          .slice(0, 20) // Top 20 largest tables
          .map((t) => t.tablename);

        logger.info(`Found ${tablesToVacuum.length} non-partitioned tables`);
      } else if (options.all || options.full) {
        // Default with --full or --all: ALL tables including partitions
        // Exclude only very small tables (< 1 MB)
        tablesToVacuum = allTables
          .filter((t) => t.size_bytes > 1024 * 1024) // > 1 MB
          .map((t) => t.tablename);

        logger.info(
          `Found ${tablesToVacuum.length} tables (including partitions)`
        );
      } else {
        // Default without --full: Top 20 non-partitioned tables
        tablesToVacuum = allTables
          .filter(
            (t) =>
              !t.tablename.startsWith('killmails') &&
              !t.tablename.startsWith('attackers') &&
              !t.tablename.startsWith('items')
          )
          .slice(0, 20)
          .map((t) => t.tablename);

        logger.info(`Found ${tablesToVacuum.length} non-partitioned tables`);
      }
    }

    if (tablesToVacuum.length === 0) {
      logger.warn('No tables to vacuum!');
      process.exit(0);
    }

    // Get sizes before
    const sizesBefore = new Map<string, number>();
    for (const table of tablesToVacuum) {
      try {
        // Use identifier() for proper quoting
        const result = await sql`
          SELECT pg_total_relation_size(${'public.' + table}) AS bytes
        `;
        sizesBefore.set(table, Number(result[0].bytes));
      } catch {
        logger.warn(`Could not get size for ${table}`);
      }
    }

    // Show what will be done
    const operation = options.full ? 'VACUUM FULL' : 'VACUUM';
    logger.info(
      `\nOperation: ${operation}${options.analyze ? ' ANALYZE' : ''}`
    );
    logger.info(`Tables to process: ${tablesToVacuum.length}`);

    if (options.full) {
      logger.warn('\n⚠️  VACUUM FULL will LOCK tables during processing!');
      logger.warn('⚠️  Ensure no active queries are running.');
    }

    if (options.dryRun) {
      logger.info('\n=== DRY RUN - Tables that would be processed ===');
      for (const table of tablesToVacuum) {
        const sizeBefore = sizesBefore.get(table);
        const sizeStr = sizeBefore
          ? `(${(sizeBefore / 1024 / 1024).toFixed(2)} MB)`
          : '';
        logger.info(`  ${table} ${sizeStr}`);
      }
      logger.info('\nRe-run without --dry-run to execute.');
      process.exit(0);
    }

    // Confirm before proceeding with VACUUM FULL
    if (options.full && !options.dryRun) {
      logger.info('\nStarting in 5 seconds... (Ctrl+C to cancel)');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Process tables
    logger.info('\n=== Processing Tables ===\n');

    const startTime = performance.now();
    let successCount = 0;
    let failCount = 0;
    const results: Array<{
      table: string;
      success: boolean;
      duration: number;
      saved?: number;
    }> = [];

    for (const table of tablesToVacuum) {
      const sizeBefore = sizesBefore.get(table) || 0;
      logger.info(
        `Processing ${table} (${(sizeBefore / 1024 / 1024).toFixed(2)} MB)...`
      );

      const result = await vacuumTable(sql, table, options);

      if (result.success) {
        // Get size after
        let sizeAfter = 0;
        try {
          const afterResult = await sql`
            SELECT pg_total_relation_size(${'public.' + table}) AS bytes
          `;
          sizeAfter = Number(afterResult[0].bytes);
        } catch {
          // Ignore
        }

        const saved = sizeBefore - sizeAfter;
        const savedMB = (saved / 1024 / 1024).toFixed(2);
        const savedPercent =
          sizeBefore > 0 ? ((saved / sizeBefore) * 100).toFixed(1) : '0';

        logger.success(
          `✓ ${table} - ${result.duration.toFixed(2)}s` +
            (saved > 0 ? ` - saved ${savedMB} MB (${savedPercent}%)` : '')
        );

        successCount++;
        results.push({
          table,
          success: true,
          duration: result.duration,
          saved,
        });
      } else {
        logger.error(`✗ ${table} - Failed:`, result.error);
        failCount++;
        results.push({ table, success: false, duration: result.duration });
      }
    }

    // REINDEX if requested
    if (options.reindex && options.full && successCount > 0) {
      logger.info('\n=== Reindexing Tables ===\n');

      for (const result of results) {
        if (!result.success) continue;

        try {
          logger.info(`Reindexing ${result.table}...`);
          const startReindex = performance.now();
          // Properly quote table name
          const quotedTable = `"${result.table}"`;
          await sql.unsafe(`REINDEX TABLE ${quotedTable}`);
          const duration = ((performance.now() - startReindex) / 1000).toFixed(
            2
          );
          logger.success(`✓ ${result.table} - ${duration}s`);
        } catch (error) {
          logger.error(`✗ Failed to reindex ${result.table}`, { error });
        }
      }
    }

    // Run ANALYZE on whole database if not already done per-table
    if (!options.analyze) {
      logger.info('\n=== Running Database-Wide ANALYZE ===');
      try {
        await sql.unsafe('ANALYZE');
        logger.success('✓ ANALYZE completed');
      } catch (error) {
        logger.error('✗ ANALYZE failed', { error });
      }
    }

    // Get database size after
    const dbSizeAfter = await sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS size,
             pg_database_size(current_database()) AS bytes
    `;

    const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
    const totalSaved = results.reduce((sum, r) => sum + (r.saved || 0), 0);
    const totalSavedMB = (totalSaved / 1024 / 1024).toFixed(2);

    // Summary
    logger.info('\n=== VACUUM SUMMARY ===');
    logger.info(`Database size before: ${dbSizeBefore[0].size}`);
    logger.info(`Database size after:  ${dbSizeAfter[0].size}`);
    logger.info(`Space reclaimed:      ${totalSavedMB} MB`);
    logger.info('');
    logger.info(`Tables processed: ${tablesToVacuum.length}`);
    logger.info(`  Success: ${successCount}`);
    logger.info(`  Failed: ${failCount}`);
    logger.info(`Total time: ${totalTime}s`);

    if (options.full) {
      logger.info(
        '\n💡 Tip: Run VACUUM regularly on old partitions to maintain optimal size.'
      );
    }

    await sql.end();
    process.exit(failCount > 0 ? 1 : 0);
  },
};
