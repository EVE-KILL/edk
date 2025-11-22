import { defineEventHandler } from 'h3';
import { database } from '../helpers/database';

export default defineEventHandler(async (_event) => {
  try {
    // Get migration history
    const migrations = await database.sql`
      SELECT
        id,
        filename,
        checksum,
        applied_at,
        success
      FROM migrations
      ORDER BY applied_at DESC
      LIMIT 20
    `;

    // Get current schema info
    const tableNames = await database.sql<{ name: string }[]>`
      SELECT table_name as name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    // Get actual row counts and sizes for each table
    const tables = await Promise.all(
      tableNames.map(async (table) => {
        try {
          const [rowCountResult] = await database.sql<{ count: number }[]>`
            SELECT count(*) as count FROM ${database.sql(table.name)}
          `;
          // In Postgres, getting exact size usually involves pg_total_relation_size
          const [sizeResult] = await database.sql<{ size: number }[]>`
            SELECT pg_total_relation_size(${table.name}) as size
          `;

          return {
            name: table.name,
            engine: 'Postgres',
            total_rows: Number(rowCountResult?.count) || 0,
            total_bytes: Number(sizeResult?.size) || 0,
          };
        } catch (err) {
          logger.error(`Error getting stats for ${table.name}:`, {
            error: String(err),
          });
          return {
            name: table.name,
            engine: 'Postgres',
            total_rows: 0,
            total_bytes: 0,
          };
        }
      })
    );

    // Get database info
    const [dbInfo] = await database.sql<{ version: string; uptime: number }[]>`
      SELECT
        version() as version,
        EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())) as uptime
    `;

    return {
      status: 'ok',
      database: {
        version: dbInfo?.version || 'unknown',
        uptime: dbInfo?.uptime || 0,
        name: process.env.POSTGRES_DB || 'edk',
      },
      migrations: {
        total: migrations.length,
        latest: migrations[0] || null,
        history: migrations,
      },
      tables: {
        count: tables.length,
        list: tables,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Schema status error:', { error: String(error) });

    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
});
