/**
 * Cache configuration types
 */

export interface CacheConfig {
  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Vary cache by request properties
   * Examples: ['id', 'userId', 'query']
   */
  vary?: string[];

  /**
   * Mark as private (user-specific) cache
   * Adds Cache-Control: private header
   */
  private?: boolean;

  /**
   * Skip caching if condition is met
   */
  skipIf?: (req: Request) => boolean;

  /**
   * Custom cache key generator
   */
  key?: string | ((req: Request) => string);

  /**
   * Tags for cache invalidation (future use)
   */
  tags?: string[];
}

/**
 * Extend RouteController with cache configuration
 */
declare global {
  interface RouteController {
    cacheConfig?: CacheConfig;
  }
}

export {};
