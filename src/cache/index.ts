/**
 * Cache module
 * Provides caching functionality for the application
 */

import { createCache } from "./factory";
import type { CacheAdapter } from "./adapter";
import { logger } from "../utils/logger";

export type { CacheAdapter, CacheStats } from "./adapter";
export { createCache } from "./factory";
export {
  buildResponseCacheKey,
  buildDataCacheKey,
  shouldCacheResponse,
  serializeResponse,
  deserializeResponse,
} from "./cache-key";

// Check if cache is enabled
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
const CACHE_ENABLED = process.env.CACHE_ENABLED !== "false";

// Disable cache by default in development
const shouldEnableCache = CACHE_ENABLED && !IS_DEVELOPMENT;

// Create singleton cache instance
export const cache: CacheAdapter = shouldEnableCache
  ? createCache()
  : createCache("none");

// Log cache status on startup
if (!shouldEnableCache) {
  logger.cache("disabled (development mode or CACHE_ENABLED=false)");
} else {
  const driver = process.env.CACHE_DRIVER || "lru";
  logger.cache(`enabled (driver: ${driver})`);
}
