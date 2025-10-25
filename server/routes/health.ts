export default defineEventHandler(async (event) => {
  try {
    // Test ClickHouse connection
    const dbConnected = await database.ping()

    // Test Redis cache
    const cacheKey = 'test:connection'
    await cache.set(cacheKey, { timestamp: Date.now(), message: 'Hello from cache!' }, 60)
    const cachedData = await cache.get(cacheKey)

    // Get some basic ClickHouse info
    let dbInfo: any = null
    if (dbConnected) {
      try {
        dbInfo = await database.queryOne('SELECT version() as version')
      } catch (error) {
        console.error('Failed to get ClickHouse version:', error)
      }
    }

    return {
      status: 'ok',
      services: {
        clickhouse: {
          connected: dbConnected,
          version: dbInfo?.version || 'unknown'
        },
        redis: {
          connected: cachedData !== null,
          testData: cachedData
        }
      },
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('Health check error:', error)

    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
})
