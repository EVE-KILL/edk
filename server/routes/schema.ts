import { database } from '../helpers/database'

export default defineEventHandler(async (event) => {
  try {
    // Get migration history
    const migrations = await database.query(`
      SELECT
        id,
        filename,
        checksum,
        applied_at,
        success
      FROM migrations
      ORDER BY applied_at DESC
      LIMIT 20
    `)

    // Get current schema info
    const tableNames = await database.query<{ name: string }>(`
      SELECT name
      FROM system.tables
      WHERE database = {database:String}
      ORDER BY name
    `, { database: process.env.CLICKHOUSE_DB || 'edk' })

    // Get actual row counts and sizes for each table
    const tables = await Promise.all(
      tableNames.map(async (table) => {
        try {
          const rowCount = await database.queryValue<number>(
            `SELECT count() FROM \`${table.name}\``
          )
          const size = await database.queryValue<number>(
            `SELECT sum(bytes_on_disk) FROM system.parts WHERE database = {database:String} AND table = {table:String}`,
            { database: process.env.CLICKHOUSE_DB || 'edk', table: table.name }
          )

          return {
            name: table.name,
            engine: 'MergeTree',
            total_rows: rowCount || 0,
            total_bytes: size || 0
          }
        } catch (err) {
          return {
            name: table.name,
            engine: 'MergeTree',
            total_rows: 0,
            total_bytes: 0
          }
        }
      })
    )

    // Get database info
    const dbInfo = await database.queryOne(`
      SELECT
        version() as version,
        uptime() as uptime
    `)

    return {
      status: 'ok',
      database: {
        version: dbInfo?.version || 'unknown',
        uptime: dbInfo?.uptime || 0,
        name: process.env.CLICKHOUSE_DB || 'edk'
      },
      migrations: {
        total: migrations.length,
        latest: migrations[0] || null,
        history: migrations
      },
      tables: {
        count: tables.length,
        list: tables
      },
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Schema status error:', error)

    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
})
