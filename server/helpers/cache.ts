import Redis from 'ioredis'

/**
 * Redis Cache Helper
 *
 * Provides a convenient interface for caching operations using Redis.
 * Can be used alongside Nitro's built-in cache or independently.
 */
export class CacheHelper {
  private redis: Redis

  constructor() {
    // Create Redis connection using environment variables
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: 0,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    })

    // Handle connection events
    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error)
    })

    this.redis.on('connect', () => {
      console.log('Redis connected successfully')
    })
  }

  /**
   * Set a value in cache with optional TTL
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)

      if (ttl) {
        await this.redis.setex(key, ttl, serialized)
      } else {
        await this.redis.set(key, serialized)
      }
    } catch (error) {
      console.error('Cache set error:', error)
      throw error
    }
  }

  /**
   * Get a value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key)

      if (!value) {
        return null
      }

      return JSON.parse(value) as T
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  /**
   * Check if a key exists in cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key)
      return exists === 1
    } catch (error) {
      console.error('Cache has error:', error)
      return false
    }
  }

  /**
   * Remove a key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    try {
      await this.redis.flushdb()
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute if not exists
   */
  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T> | T,
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key)

    if (cached !== null) {
      return cached
    }

    const value = await factory()
    await this.set(key, value, ttl)

    return value
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(key: string, delta: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, delta)
    } catch (error) {
      console.error('Cache increment error:', error)
      throw error
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, seconds)
      return result === 1
    } catch (error) {
      console.error('Cache expire error:', error)
      return false
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key)
    } catch (error) {
      console.error('Cache TTL error:', error)
      return -1
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.disconnect()
  }

  /**
   * Generate a cache key with namespace
   */
  key(...parts: (string | number)[]): string {
    return parts.filter(part => part !== null && part !== undefined).join(':')
  }
}

// Export a singleton instance
export const cache = new CacheHelper()

// Export types for convenience
export type CacheValue<T> = T | null
export type CacheFactory<T> = () => Promise<T> | T
