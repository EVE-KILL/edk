export default defineEventHandler(async (event) => {
  const method = getMethod(event)

  if (method !== 'POST') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed. Use POST to reset schema.'
    })
  }

  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Schema reset not allowed in production'
      })
    }

    console.log('🔄 Manual schema reset requested...')

    // Get list of all tables in the database
    const tables = await database.query(`
      SELECT name FROM system.tables
      WHERE database = {database:String}
      AND name NOT IN ('migrations')
    `, { database: process.env.CLICKHOUSE_DB || 'edk' })

    let droppedCount = 0

    // Drop all tables except migrations
    for (const table of tables as any[]) {
      try {
        await database.execute(`DROP TABLE IF EXISTS ${table.name}`)
        droppedCount++
        console.log(`🗑️  Dropped table: ${table.name}`)
      } catch (error) {
        console.error(`❌ Failed to drop table ${table.name}:`, error)
      }
    }

    // Clear migrations table to force re-application
    await database.execute('TRUNCATE TABLE migrations')
    console.log('🧹 Cleared migrations table')

    return {
      status: 'success',
      message: 'Schema reset completed',
      dropped_tables: droppedCount,
      note: 'Restart the server to re-apply schema',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Schema reset error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Schema reset failed'
    })
  }
})
