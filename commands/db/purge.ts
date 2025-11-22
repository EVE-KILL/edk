import { database } from '../../server/helpers/database'
import { logger } from '../../server/helpers/logger'

export async function purgeDatabase() {
  logger.warn('⚠️  Purging database! All data will be lost.')

  const tablesResult = await database.sql<{ tableName: string }[]>`
    SELECT table_name as "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `
  const tables = tablesResult.map(row => row.tableName)

  for (const table of tables) {
    if (table !== 'spatial_ref_sys') {
      logger.info(`Dropping table: ${table}`)
      await database.sql.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`)
    }
  }

  const viewsResult = await database.sql<{ viewName: string }[]>`
    SELECT matviewname as "viewName"
    FROM pg_matviews
    WHERE schemaname = 'public'
  `
  const views = viewsResult.map(row => row.viewName)
  for (const view of views) {
    logger.info(`Dropping materialized view: ${view}`)
    await database.sql.unsafe(`DROP MATERIALIZED VIEW IF EXISTS "${view}" CASCADE`)
  }

  const remainingTables = await database.sql<{ tableName: string }[]>`
    SELECT table_name as "tableName"
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != 'spatial_ref_sys'
  `
  const remainingViews = await database.sql<{ viewName: string }[]>`
    SELECT matviewname as "viewName"
    FROM pg_matviews
    WHERE schemaname = 'public'
  `

  if (remainingTables.length === 0 && remainingViews.length === 0) {
    logger.success('✅ Database purged successfully.')
  } else {
    const remaining = [
      ...remainingTables.map(t => t.tableName),
      ...remainingViews.map(v => v.viewName)
    ]
    logger.warn(`⚠️  Database purged but some objects remain: ${remaining.join(', ')}`)
  }
}

async function action() {
  try {
    await purgeDatabase()
  } catch (error) {
    logger.error('❌ Database purge failed:', { error: error instanceof Error ? error.message : String(error) })
    process.exit(1)
  } finally {
    await database.sql.end()
  }
}

export default () => ({
  description: 'Purge and reset the database (Use with caution!)',
  action
})
