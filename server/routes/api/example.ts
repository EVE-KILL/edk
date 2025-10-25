// Example API route demonstrating cache and database usage
export default defineEventHandler(async (event) => {
  const url = new URL(event.node.req.url!, `http://${event.node.req.headers.host}`)
  const key = url.searchParams.get('key') || 'example'

  try {
    // Try to get data from cache first
    const cached = await cache.get(`api:example:${key}`)
    if (cached) {
      return {
        source: 'cache',
        key,
        data: cached,
        timestamp: new Date().toISOString()
      }
    }

    // If not in cache, generate some data and store it
    const data = {
      message: `Hello from API! Key: ${key}`,
      random: Math.random(),
      timestamp: new Date().toISOString()
    }

    // Store in cache for 30 seconds
    await cache.set(`api:example:${key}`, data, 30)

    // Increment a counter in cache
    const counter = await cache.increment(`api:example:counter`)

    return {
      source: 'generated',
      key,
      data,
      counter,
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('API error:', error)

    return {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }
  }
})
