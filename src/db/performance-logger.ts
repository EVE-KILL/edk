import type { Logger } from "drizzle-orm/logger";
import { NoopLogger } from "drizzle-orm/logger";
import type { PerformanceTracker } from "../utils/performance";
import type { Database, Statement } from "bun:sqlite";

/**
 * Performance tracking logger for Drizzle ORM
 * Note: Drizzle's logQuery is called BEFORE query execution, so we can't measure
 * actual execution time here. Use wrapDatabaseForPerformance for accurate timing.
 */
export class PerformanceLogger implements Logger {
  private fallbackLogger: Logger;

  constructor(fallbackLogger?: Logger) {
    this.fallbackLogger = fallbackLogger || new NoopLogger();
  }

  /**
   * Log query - just for dev mode logging
   * Actual timing is done in the wrapped Database methods
   */
  logQuery(query: string, params: unknown[]): void {
    // Just call the fallback logger (for dev mode logging)
    this.fallbackLogger.logQuery(query, params);
  }
}

/**
 * Wrap Bun's Database to track query execution time
 * This intercepts the actual SQLite prepare() calls to measure real execution time
 */
export function wrapDatabaseForPerformance(
  db: Database,
  getTracker: () => PerformanceTracker | null
): Database {
  // Store original prepare method
  const originalPrepare = db.prepare.bind(db);
  
  // Override prepare to wrap statements with performance tracking
  const wrappedDb = new Proxy(db, {
    get(target, prop) {
      if (prop === 'prepare') {
        return function(...args: Parameters<typeof originalPrepare>) {
          const stmt = originalPrepare(...args);
          return wrapStatement(stmt, getTracker);
        };
      }
      return (target as any)[prop];
    }
  });

  return wrappedDb;
}

/**
 * Wrap a prepared statement to track execution time
 * Wraps run(), get(), all(), and values() methods
 */
function wrapStatement(
  stmt: Statement,
  getTracker: () => PerformanceTracker | null
): Statement {
  const originalRun = stmt.run.bind(stmt);
  const originalGet = stmt.get.bind(stmt);
  const originalAll = stmt.all.bind(stmt);
  const originalValues = stmt.values.bind(stmt);

  // Wrap statement methods using Proxy to preserve types
  return new Proxy(stmt, {
    get(target, prop) {
      if (prop === 'run') {
        return function(...params: any[]) {
          const tracker = getTracker();
          if (!tracker) return originalRun(...params);
          
          const start = performance.now();
          try {
            return originalRun(...params);
          } finally {
            tracker.recordQuery(performance.now() - start);
          }
        };
      }

      if (prop === 'get') {
        return function(...params: any[]) {
          const tracker = getTracker();
          if (!tracker) return originalGet(...params);
          
          const start = performance.now();
          try {
            return originalGet(...params);
          } finally {
            tracker.recordQuery(performance.now() - start);
          }
        };
      }

      if (prop === 'all') {
        return function(...params: any[]) {
          const tracker = getTracker();
          if (!tracker) return originalAll(...params);
          
          const start = performance.now();
          try {
            return originalAll(...params);
          } finally {
            tracker.recordQuery(performance.now() - start);
          }
        };
      }

      if (prop === 'values') {
        return function(...params: any[]) {
          const tracker = getTracker();
          if (!tracker) return originalValues(...params);
          
          const start = performance.now();
          try {
            return originalValues(...params);
          } finally {
            tracker.recordQuery(performance.now() - start);
          }
        };
      }

      return (target as any)[prop];
    }
  });
}
