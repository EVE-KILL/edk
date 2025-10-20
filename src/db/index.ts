import { drizzle, BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "../../db/schema";
import { logger } from "../utils/logger";

// Declare global VERBOSE_MODE
declare global {
  var VERBOSE_MODE: boolean;
}

// Cache environment variables
const DATABASE_PATH = process.env.DATABASE_PATH || "./data/ekv4.db";
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

/**
 * Database connection singleton
 * Uses Bun's native SQLite driver with Drizzle ORM
 */
class DatabaseConnection {
  private static instance: BunSQLiteDatabase<typeof schema> | null = null;
  private static queueInstance: BunSQLiteDatabase<typeof schema> | null = null;
  private static sqlite: Database | null = null;

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
      this.sqlite = new Database(DATABASE_PATH, { create: true });

      // Enable WAL mode for better concurrency
      this.sqlite.run("PRAGMA journal_mode = WAL;");

      // Enable foreign keys
      this.sqlite.run("PRAGMA foreign_keys = ON;");

      // Create Drizzle instance with logging for main app (only if verbose mode enabled)
      const shouldLog = IS_DEVELOPMENT && globalThis.VERBOSE_MODE;

      this.instance = drizzle(this.sqlite, {
        schema,
        logger: shouldLog,
      });

      // Create separate Drizzle instance without logging for queue (shares same SQLite connection)
      this.queueInstance = drizzle(this.sqlite, {
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
    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
      this.instance = null;
      this.queueInstance = null;
      logger.database("Connection closed");
    }
  }

  /**
   * Get the raw SQLite database instance
   */
  static getSqlite(): Database | null {
    return this.sqlite;
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
