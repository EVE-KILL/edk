/**
 * Cache adapter interface
 * Provides a consistent API for different cache backends (LRU, Redis, etc.)
 */

export interface CacheAdapter {
  /**
   * Get a value from the cache
   * @returns The cached value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (optional)
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Check if a key exists in the cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete a key from the cache
   */
  delete(key: string): Promise<boolean>;

  /**
   * Clear all entries from the cache
   */
  clear(): Promise<void>;

  /**
   * Get the number of items in the cache
   */
  size(): Promise<number>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage?: number; // in bytes
}
