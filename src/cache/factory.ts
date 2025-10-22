import type { CacheAdapter } from "./adapter";
import { LRUCacheAdapter } from "./lru-adapter";
import { RedisCacheAdapter } from "./redis-adapter";

/**
 * Cache factory
 * Creates a cache adapter based on environment configuration
 */
export function createCache(driver?: string): CacheAdapter {
  const cacheDriver = driver || process.env.CACHE_DRIVER || "lru";

  switch (cacheDriver.toLowerCase()) {
    case "lru":
      return new LRUCacheAdapter({
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || "1000000", 10),
        maxMemory: parseInt(process.env.CACHE_MAX_MEMORY || "2048", 10), // Increased from 512MB to 2GB
        ttl: parseInt(process.env.CACHE_DEFAULT_TTL || "300", 10),
      });

    case "redis":
      return new RedisCacheAdapter({
        url: process.env.REDIS_URL,
        prefix: process.env.REDIS_PREFIX || "ekv4:cache:",
        ttl: parseInt(process.env.REDIS_TTL || "300", 10),
      });

    case "none":
      return new NullCacheAdapter();

    default:
      console.warn(`Unknown cache driver '${cacheDriver}', falling back to LRU`);
      return new LRUCacheAdapter();
  }
}

/**
 * Null cache adapter (no-op)
 * Used when caching is disabled
 */
class NullCacheAdapter implements CacheAdapter {
  async get<T>(key: string): Promise<T | null> {
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // No-op
  }

  async has(key: string): Promise<boolean> {
    return false;
  }

  async delete(key: string): Promise<boolean> {
    return false;
  }

  async clear(): Promise<void> {
    // No-op
  }

  async size(): Promise<number> {
    return 0;
  }

  async getStats() {
    return {
      size: 0,
      maxSize: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
    };
  }
}
