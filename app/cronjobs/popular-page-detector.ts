import { BaseCronjob, type CronjobResult } from "../../src/scheduler/base-cronjob";
import { cache } from "../../src/cache";
import { cacheWarmingCoordinator } from "../../src/cache/warming-coordinator";
import { DatabaseConnection } from "../../src/db";
import { jobs } from "../../db/schema/jobs";
import { logger } from "../../src/utils/logger";

/**
 * Popular Page Detector - Proactive Cache Warming
 *
 * Detects popular pages (>40% of traffic) and proactively refreshes them
 * before they expire to keep hot content always fresh.
 *
 * - Disabled in development mode
 * - Runs every 5 seconds (sub-minute)
 * - Only triggers if minimum traffic threshold met
 */
export default class PopularPageDetectorCronjob extends BaseCronjob {
  private recentlyQueued = new Map<string, number>(); // Track recently queued pages

  metadata = {
    name: "popular-page-detector",
    description: "Detect and proactively refresh popular pages (cache warming)",
    schedule: "* * * * *", // Every minute (cron format: minute hour day month day-of-week)
    timeout: 30000, // 30 second max execution time
    enabled: process.env.NODE_ENV === "production" && process.env.CACHE_WARMING_ENABLED !== "false",
  };

  async execute(): Promise<CronjobResult> {
    try {
      // Get configuration from environment
      const trafficThreshold = parseFloat(process.env.CACHE_REFRESH_THRESHOLD || "0.4"); // 40%
      const minTraffic = parseInt(process.env.CACHE_REFRESH_MIN_TRAFFIC || "100", 10);
      const dedupeWindow = parseInt(process.env.CACHE_REFRESH_DEDUPE_WINDOW || "30000", 10); // 30s
      const cleanupInterval = parseInt(process.env.CACHE_CLEANUP_INTERVAL || "60000", 10); // 60s

      // Periodically clean up old dedupe entries
      if (Date.now() % cleanupInterval < 5000) {
        this.cleanupRecentlyQueued();
      }

      // Get stats from coordinator
      const stats = cacheWarmingCoordinator.getStats();

      if (stats.totalRequests < minTraffic) {
        // Not enough traffic to analyze
        return {
          success: true,
          message: `Insufficient traffic (${stats.totalRequests} < ${minTraffic} threshold)`,
        };
      }

      // Identify popular pages
      const popularPages = stats.pages.filter((p) => p.percentage >= trafficThreshold * 100);

      if (popularPages.length === 0) {
        return {
          success: true,
          message: `No pages exceed ${trafficThreshold * 100}% threshold (${stats.pages.length} pages analyzed)`,
        };
      }

      // Queue refresh jobs for popular pages
      let queued = 0;
      for (const page of popularPages) {
        // Check if recently queued to avoid hammering the same page
        const lastQueued = this.recentlyQueued.get(page.key);
        if (lastQueued && Date.now() - lastQueued < dedupeWindow) {
          logger.debug(`[Cache Warming] Skipping recently queued: ${page.key}`);
          continue;
        }

        // Enqueue refresh job via database
        try {
          const db = DatabaseConnection.getQueueInstance();
          await db
            .insert(jobs)
            .values({
              queue: "cache-refresh",
              type: "refresh",
              payload: JSON.stringify({
                cacheKey: page.key,
                accessCount: page.accesses,
              }),
              status: "pending",
              availableAt: new Date(),
              createdAt: new Date(),
              attempts: 0,
              maxAttempts: 1,
              priority: 10, // Low priority
            });

          this.recentlyQueued.set(page.key, Date.now());
          queued++;

          logger.debug(
            `[Cache Warming] Queued refresh: ${page.key} (${page.accesses} hits, ${page.percentage.toFixed(1)}%)`
          );
        } catch (error) {
          logger.error(`[Cache Warming] Failed to queue: ${page.key}`, error);
        }
      }

      // Reset stats for next window
      cacheWarmingCoordinator.reset();

      return {
        success: true,
        message: `Analyzed ${stats.pages.length} pages, queued ${queued} for refresh (threshold: ${trafficThreshold * 100}%, min traffic: ${minTraffic})`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[Cache Warming] Detector failed: ${message}`, error);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Clean up old dedupe entries
   */
  private cleanupRecentlyQueued(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minute

    for (const [key, timestamp] of this.recentlyQueued.entries()) {
      if (now - timestamp > maxAge) {
        this.recentlyQueued.delete(key);
      }
    }
  }
}
