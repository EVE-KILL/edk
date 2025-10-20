import type { CacheAdapter, CacheStats } from "./adapter";

/**
 * Redis Cache Adapter (Future Implementation)
 * Placeholder for Redis support - not yet implemented
 */
export class RedisCacheAdapter implements CacheAdapter {
  constructor(options: { url?: string; prefix?: string; ttl?: number } = {}) {
    throw new Error(
      "Redis cache adapter is not yet implemented. Use 'lru' cache driver instead."
    );
  }

  async get<T>(key: string): Promise<T | null> {
    throw new Error("Not implemented");
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    throw new Error("Not implemented");
  }

  async has(key: string): Promise<boolean> {
    throw new Error("Not implemented");
  }

  async delete(key: string): Promise<boolean> {
    throw new Error("Not implemented");
  }

  async clear(): Promise<void> {
    throw new Error("Not implemented");
  }

  async size(): Promise<number> {
    throw new Error("Not implemented");
  }

  async getStats(): Promise<CacheStats> {
    throw new Error("Not implemented");
  }
}
