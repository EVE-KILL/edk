import Redis from 'ioredis'

/**
 * Create a Redis client with standardized configuration
 * @returns Configured Redis client instance
 */
export function createRedisClient(): Redis {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: 0,
  })
}
