/**
 * Cache configuration types
 */

export interface CacheConfig {
  /**
   * Time to live in seconds
   * How long the response is considered "fresh"
   */
  ttl?: number;

  /**
   * Stale-while-revalidate period in seconds
   * How long to serve stale content while fetching fresh data in background
   *
   * Example: ttl=60, staleWhileRevalidate=60
   * - 0-60s: Serve fresh from cache
   * - 60-120s: Serve stale + refresh in background
   * - 120s+: Block and fetch fresh
   */
  staleWhileRevalidate?: number;

  /**
   * Stale-if-error period in seconds
   * How long to serve stale content if revalidation fails
   * Useful for graceful degradation during database issues
   */
  staleIfError?: number;

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

  /**
   * Allow proactive cache warming when popular
   * Set to false to disable for this route
   * Default: enabled if cache warming is globally enabled
   */
  allowProactiveRefresh?: boolean;
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
