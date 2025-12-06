import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';

export default {
  description: 'Kill stuck war_top_statistics refresh queries',
  action: async () => {
    logger.info('Searching for stuck queries...');

    const query = `
      SELECT pid, state, age(clock_timestamp(), query_start) as duration, query
      FROM pg_stat_activity
      WHERE state = 'active'
        AND query ILIKE '%REFRESH MATERIALIZED VIEW%war_top_statistics%'
        AND query NOT ILIKE '%pg_stat_activity%' -- Exclude self
      ORDER BY duration DESC;
    `;

    const rows = await database.query<any>(query);

    if (rows.length === 0) {
      logger.info('No stuck queries found.');
      process.exit(0);
    }

    logger.info(`Found ${rows.length} stuck queries:`);
    console.table(rows.map(r => ({ pid: r.pid, duration: r.duration, query: r.query.substring(0, 50) + '...' })));

    for (const row of rows) {
      logger.warn(`Killing PID ${row.pid} (${row.duration})...`);
      try {
        await database.query(`SELECT pg_terminate_backend(${row.pid})`);
        logger.success(`  ✓ Killed ${row.pid}`);
      } catch (err) {
        logger.error(`  ✗ Failed to kill ${row.pid}: ${err}`);
      }
    }

    process.exit(0);
  },
};
