import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null
})

export const cache = {
  async get(key: string): Promise<string | null> {
    return redis.get(key)
  },

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await redis.set(key, value, 'EX', ttlSeconds)
  },

  async del(key: string): Promise<void> {
    await redis.del(key)
  }
}
