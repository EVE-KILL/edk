import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "../../db/schema";
import { logger } from "../utils/logger";
import { PerformanceLogger, wrapDatabaseForPerformance } from "./performance-logger";
import { DefaultLogger } from "drizzle-orm/logger";
import type { PerformanceTracker } from "../utils/performance";

// Declare global VERBOSE_MODE
declare global {
  var VERBOSE_MODE: boolean;
}

// Cache environment variables
const DATABASE_PATH = process.env.DATABASE_PATH || "./data/ekv4.db";
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

/**
 * Global performance logger instance
 * Shared across all requests to track query performance
 */
export const performanceLogger = new PerformanceLogger(
  IS_DEVELOPMENT && globalThis.VERBOSE_MODE ? new DefaultLogger() : undefined
);

/**
 * Global performance tracker getter
 * Controllers set this per-request to track their query performance
 */
let currentPerformanceTracker: PerformanceTracker | null = null;

export function setCurrentPerformanceTracker(tracker: PerformanceTracker | null): void {
  currentPerformanceTracker = tracker;
}

export function getCurrentPerformanceTracker(): PerformanceTracker | null {
  return currentPerformanceTracker;
}

/**
 * Database connection singleton
 * Uses Bun's native SQLite driver with Drizzle ORM
 */
class DatabaseConnection {
  private static instance: BunSQLiteDatabase<typeof schema> | null = null;
  private static queueInstance: BunSQLiteDatabase<typeof schema> | null = null;
  private static sqlite: Database | null = null;
  private static rawSqlite: Database | null = null; // Keep raw unwrapped instance

  /**
   * Get the database connection instance (with query logging in dev)
   */
  static getInstance(): BunSQLiteDatabase<typeof schema> {
    if (!this.instance) {
      this.connect();
    }
    return this.instance!;
  }

  /**
   * Get the queue database connection instance (without query logging)
   * This prevents spammy logs from constant queue polling
   */
  static getQueueInstance(): BunSQLiteDatabase<typeof schema> {
    if (!this.queueInstance) {
      this.connect();
    }
    return this.queueInstance!;
  }

  /**
   * Connect to the database
   */
  private static connect(): void {
    try {
      // Create data directory if it doesn't exist
      const dataDir = DATABASE_PATH.substring(0, DATABASE_PATH.lastIndexOf("/"));
      if (dataDir && !Bun.file(dataDir).exists()) {
        require("fs").mkdirSync(dataDir, { recursive: true });
      }

      // Create SQLite connection
      const rawSqlite = new Database(DATABASE_PATH, { create: true });

      // ==== WAL Mode Configuration ====
      // Enable WAL mode for better concurrency (multiple readers + 1 writer)
      rawSqlite.run("PRAGMA journal_mode = WAL;");

      // WAL auto-checkpoint: Checkpoint after 1000 pages (~4MB with 4KB pages)
      // This prevents WAL file from growing too large
      rawSqlite.run("PRAGMA wal_autocheckpoint = 1000;");

      // ==== Safety & Integrity ====
      // Enable foreign keys (important for data integrity)
      rawSqlite.run("PRAGMA foreign_keys = ON;");

      // NORMAL synchronous mode: Faster than FULL, still safe with WAL
      // WAL mode ensures durability even with NORMAL
      rawSqlite.run("PRAGMA synchronous = NORMAL;");

      // ==== Performance Optimizations ====
      // Busy timeout: Wait up to 5 seconds for locks before failing
      // Critical for concurrent access from web server + queue workers
      rawSqlite.exec("PRAGMA busy_timeout = 5000;");

      // Cache size: 64MB cache for frequently accessed pages
      // Negative value = kibibytes, positive = pages
      rawSqlite.exec("PRAGMA cache_size = -64000;");

      // Temp store: Use memory for temporary tables/indexes (faster)
      rawSqlite.exec("PRAGMA temp_store = MEMORY;");

      // Memory-mapped I/O: 256MB for faster reads of frequently accessed data
      // For a 666MB database, this covers ~40% in fast memory access
      rawSqlite.exec("PRAGMA mmap_size = 268435456;");

      // Page size is 4096 bytes (default, already optimal for most workloads)
      // Larger page sizes (8192, 16384) can help with large BLOBs but hurt small queries

      // ==== Query Optimization ====
      // Analysis limit: Scan more rows when running ANALYZE (better statistics)
      rawSqlite.exec("PRAGMA analysis_limit = 1000;");

      logger.database(`Connected: ${DATABASE_PATH}`);
      logger.database("Performance optimizations enabled: WAL, 64MB cache, 256MB mmap");

      // Store raw SQLite for maintenance operations
      this.rawSqlite = rawSqlite;

      // Wrap SQLite connection with performance tracking
      const wrappedSqlite = wrapDatabaseForPerformance(rawSqlite, getCurrentPerformanceTracker);
      this.sqlite = wrappedSqlite;

      // Create Drizzle instance with performance logger for tracking
      this.instance = drizzle(wrappedSqlite, {
        schema,
        logger: performanceLogger,
      });

      // Create separate Drizzle instance without logging for queue (shares same SQLite connection)
      this.queueInstance = drizzle(wrappedSqlite, {
        schema,
        logger: false, // Never log queue queries (too spammy)
      });

      logger.database(`Connected: ${DATABASE_PATH}`);
    } catch (error) {
      logger.error("Failed to connect to database:", error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  static close(): void {
    if (this.rawSqlite) {
      try {
        // Run PRAGMA optimize before closing
        // This updates query planner statistics for better performance on next startup
        logger.database("Running PRAGMA optimize...");
        this.rawSqlite.run("PRAGMA optimize;");

        // Checkpoint WAL file before closing
        // This merges WAL changes back into main database
        logger.database("Checkpointing WAL...");
        this.rawSqlite.run("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch (error) {
        logger.error("Error during database shutdown:", error);
      }

      this.rawSqlite.close();
      this.rawSqlite = null;
      this.sqlite = null;
      this.instance = null;
      this.queueInstance = null;
      logger.database("Connection closed");
    }
  }

  /**
   * Get the raw SQLite database instance (for maintenance operations)
   */
  static getRawSqlite(): Database | null {
    if (!this.rawSqlite) {
      this.connect();
    }
    return this.rawSqlite;
  }
}

/**
 * Export the DatabaseConnection class (needed for singletons)
 */
export { DatabaseConnection };

/**
 * Export the database instance (with logging in dev)
 */
export const db = DatabaseConnection.getInstance();

/**
 * Export the queue database instance (without logging)
 */
export const queueDb = DatabaseConnection.getQueueInstance();

/**
 * Export schema and types
 */
export { schema };
export type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

/**
 * Helper to close database connection (for testing or graceful shutdown)
 */
export const closeDatabase = () => DatabaseConnection.close();
