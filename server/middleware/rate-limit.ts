import { storage } from '../helpers/redis'
import { defineEventHandler, createError, getRequestIP, H3Event } from 'h3'
import { rateLimitConfig } from '../utils/rate-limits'

export default defineEventHandler(async (event: H3Event) => {
  if (!event.path.startsWith('/api/')) {
    return
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

  // Sort keys by length descending to match most specific route first
  const sortedRoutes = Object.keys(rateLimitConfig).sort((a, b) => b.length - a.length)
  const matchedRoute = sortedRoutes.find(route => event.path.startsWith(route))

  if (!matchedRoute) {
    return
  }

  const config = rateLimitConfig[matchedRoute as keyof typeof rateLimitConfig]
  const key = `rate-limit:${ip}:${matchedRoute}:${Math.floor(Date.now() / 1000 / config.window)}`

  const currentRequests = await storage.increment(key)

  if (currentRequests === 1) {
    await storage.setTTL(key, config.window * 1000)
  }

  event.node.res.setHeader('X-RateLimit-Limit', config.max)
  event.node.res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - currentRequests))

  if (currentRequests > config.max) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests'
    })
  }
})
