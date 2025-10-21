import type { PerformanceStats } from "../../app/types/request";

/**
 * Performance tracking utility
 * Tracks request duration, query count, and rendering time
 */
export class PerformanceTracker {
  private stats: PerformanceStats;

  constructor() {
    this.stats = {
      startTime: performance.now(),
      queryCount: 0,
      queryTime: 0,
    };
  }

  /**
   * Record a database query
   */
  recordQuery(duration: number): void {
    this.stats.queryCount++;
    this.stats.queryTime += duration;
  }

  /**
   * Record template rendering time
   */
  recordTemplateRender(duration: number): void {
    this.stats.templateTime = duration;
  }

  /**
   * Mark as cache hit
   */
  markCacheHit(cacheKey?: string): void {
    this.stats.cacheHit = true;
    this.stats.cacheKey = cacheKey;
  }

  /**
   * Finalize and get stats
   */
  getStats(): PerformanceStats {
    this.stats.endTime = performance.now();
    this.stats.duration = this.stats.endTime - this.stats.startTime;
    return this.stats;
  }

  /**
   * Get current stats without finalizing
   */
  getCurrentStats(): PerformanceStats {
    const currentTime = performance.now();
    return {
      ...this.stats,
      endTime: currentTime,
      duration: currentTime - this.stats.startTime,
    };
  }
}

/**
 * Create a query wrapper that tracks execution time
 */
export function createTrackedQuery<T extends (...args: any[]) => Promise<any>>(
  tracker: PerformanceTracker,
  queryFn: T
): T {
  return (async (...args: any[]) => {
    const start = performance.now();
    try {
      return await queryFn(...args);
    } finally {
      const duration = performance.now() - start;
      tracker.recordQuery(duration);
    }
  }) as T;
}

/**
 * Format stats for display
 */
export function formatStats(stats: PerformanceStats): {
  duration: string;
  queryCount: number;
  queryTime: string;
  templateTime: string;
  cacheHit: boolean;
  totalTime: string;
} {
  const duration = stats?.duration || 0;
  const queryTime = stats?.queryTime || 0;
  const templateTime = stats?.templateTime || 0;
  const otherTime = Math.max(0, duration - queryTime - templateTime);

  return {
    duration: duration.toFixed(2),
    queryCount: stats?.queryCount || 0,
    queryTime: queryTime.toFixed(2),
    templateTime: templateTime.toFixed(2),
    cacheHit: stats?.cacheHit || false,
    totalTime: duration.toFixed(2),
  };
}
