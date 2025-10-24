/**
 * Cache Warming Coordinator
 *
 * Centralized tracking for cache access patterns to enable proactive cache warming.
 * Shared between router (tracks accesses) and cronjob (analyzes patterns).
 */

export class CacheWarmingCoordinator {
  private pageStats = new Map<string, number>(); // Accesses per cache key
  private lastReset = Date.now();

  /**
   * Track a cache access
   */
  trackAccess(cacheKey: string): void {
    const current = this.pageStats.get(cacheKey) || 0;
    this.pageStats.set(cacheKey, current + 1);
  }

  /**
   * Get current traffic statistics
   */
  getStats(): {
    totalRequests: number;
    pages: Array<{
      key: string;
      accesses: number;
      percentage: number;
    }>;
  } {
    const pages: Array<{ key: string; accesses: number; percentage: number }> = [];
    let totalRequests = 0;

    // Sum all accesses
    for (const accesses of this.pageStats.values()) {
      totalRequests += accesses;
    }

    if (totalRequests === 0) {
      return { totalRequests: 0, pages: [] };
    }

    // Calculate percentages
    for (const [key, accesses] of this.pageStats.entries()) {
      const percentage = (accesses / totalRequests) * 100;
      pages.push({ key, accesses, percentage });
    }

    // Sort by accesses descending
    pages.sort((a, b) => b.accesses - a.accesses);

    return { totalRequests, pages };
  }

  /**
   * Reset all counters (called after analysis)
   */
  reset(): void {
    this.pageStats.clear();
    this.lastReset = Date.now();
  }

  /**
   * Get time since last reset
   */
  getTimeSinceReset(): number {
    return Date.now() - this.lastReset;
  }
}

// Global singleton instance
export const cacheWarmingCoordinator = new CacheWarmingCoordinator();
