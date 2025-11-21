import { LRUCache } from "lru-cache";
import type { CacheAdapter, CacheStats } from "./adapter";

/**
 * LRU Cache Adapter
 * In-memory cache with Least Recently Used eviction policy
 */
export class LRUCacheAdapter implements CacheAdapter {
  private cache: LRUCache<string, any>;
  private hits = 0;
  private misses = 0;
  private maxSize: number;

  constructor(options: {
    maxSize?: number;
    maxMemory?: number; // in MB
    ttl?: number; // default TTL in seconds
  } = {}) {
    const maxSize = options.maxSize || 1000;
    const maxMemoryMB = options.maxMemory || 512;
    const defaultTTL = options.ttl || 300;

    this.maxSize = maxSize;

    this.cache = new LRUCache({
      max: maxSize,
      maxSize: maxMemoryMB * 1024 * 1024, // Convert MB to bytes
      sizeCalculation: (value) => {
        // Estimate memory size
        const str = JSON.stringify(value);
        return str.length * 2; // Approximate bytes (UTF-16)
      },
      ttl: defaultTTL * 1000, // Convert to milliseconds
      allowStale: false, // Allow fetching stale entries (for stale-while-revalidate)
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.cache.get(key);
    if (value === undefined) {
      this.misses++;
      return null;
    }
    this.hits++;
    return value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const options = ttl ? { ttl: ttl * 1000 } : undefined; // Convert to ms
    this.cache.set(key, value, options);
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async getStats(): Promise<CacheStats> {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: parseFloat((hitRate * 100).toFixed(2)),
      memoryUsage: this.cache.calculatedSize || 0,
    };
  }
}
