import type { Job } from "../../db/schema/jobs";
import { BaseWorker } from "../../src/queue/base-worker";
import { cache } from "../../src/cache";
import type { CachedResponseEntry } from "../../src/cache/cache-key";
import {
  serializeResponse,
  wrapCacheEntry,
} from "../../src/cache/cache-key";
import { shouldCacheResponse } from "../../src/cache/cache-key";
import { logger } from "../../src/utils/logger";

/**
 * Cache Warmer - Proactive Cache Refresh Worker
 *
 * Processes cache-refresh jobs to refresh popular pages before they expire.
 * This keeps hot content perpetually fresh without waiting for cache misses.
 *
 * - Low priority (doesn't interfere with real work)
 * - Concurrency: 1 (prevent overwhelming the system)
 * - Silently fails if page no longer in cache (already evicted)
 */
export class CacheWarmer extends BaseWorker {
  queueName = "cache-refresh";
  concurrency = 1; // One at a time to avoid overwhelming
  pollInterval = 5000; // Check every 5 seconds

  async handle(
    payload: { cacheKey: string; accessCount: number },
    job: Job
  ): Promise<void> {
    const { cacheKey, accessCount } = payload;

    try {
      logger.debug(`[Cache Warmer] Refreshing: ${cacheKey}`);

      // Get cached entry to extract route info
      const entry = await cache.get<CachedResponseEntry>(cacheKey);

      if (!entry) {
        // Page no longer in cache (evicted or expired), nothing to refresh
        logger.debug(`[Cache Warmer] Cache entry not found (evicted): ${cacheKey}`);
        return;
      }

      // Parse cache key to extract route info
      // Format: route:METHOD:PATH[:params...]
      const [, method, path, ...params] = cacheKey.split(":");

      if (!method || !path) {
        logger.warn(`[Cache Warmer] Invalid cache key format: ${cacheKey}`);
        return;
      }

      // Reconstruct request URL from cache key
      const url = `http://localhost:${process.env.PORT || 3000}${path}`;

      // Create a synthetic request to refresh the cache
      const refreshRequest = new Request(url, {
        method: method,
        headers: {
          "cache-control": "no-cache", // Bypass cache for this refresh request
        },
      });

      // Get the route from the global route index if available
      // For now, we'll do an internal HTTP call to refresh
      // This is simpler and safer than trying to instantiate controllers
      const response = await fetch(refreshRequest);

      if (!response.ok) {
        logger.warn(
          `[Cache Warmer] Refresh failed with status ${response.status}: ${cacheKey}`
        );
        return;
      }

      // Check response is cacheable
      if (!shouldCacheResponse(response)) {
        logger.debug(`[Cache Warmer] Response not cacheable: ${cacheKey}`);
        return;
      }

      // Serialize the fresh response
      const serialized = await serializeResponse(response);

      // Wrap with cache metadata (keep original TTL config)
      const refreshedEntry: CachedResponseEntry = {
        data: serialized,
        cachedAt: Date.now(), // Reset to now (fresh)
        ttl: entry.ttl,
        swr: entry.swr,
        staleIfError: entry.staleIfError,
        accessCount: 0, // Reset access count
      };

      // Store back to cache with full TTL
      const cacheTTL = entry.swr ? entry.ttl + entry.swr : entry.ttl;
      await cache.set(cacheKey, refreshedEntry, cacheTTL);

      logger.info(
        `[Cache Warmer] Refreshed: ${cacheKey} (${accessCount} hits in last window)`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        `[Cache Warmer] Failed to refresh ${cacheKey}: ${message}`,
        error
      );

      // Don't throw - we don't want to retry cache warming
      // If it fails, it's okay to let the page go stale normally
    }
  }
}
