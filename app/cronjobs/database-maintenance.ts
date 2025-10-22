import { BaseCronjob, type CronjobResult } from "../../src/scheduler/base-cronjob";
import { DatabaseConnection } from "../../src/db";

/**
 * Database Maintenance Cronjob
 * Runs daily at 3 AM to optimize database performance
 *
 * Tasks:
 * - ANALYZE: Updates query planner statistics for better query optimization
 * - VACUUM: Reclaims free space and defragments the database
 * - PRAGMA optimize: Runs SQLite's automatic optimization recommendations
 * - WAL checkpoint: Prevents WAL file from growing too large
 *
 * Note: Runs at 3 AM when traffic is lowest. VACUUM will block the database
 * for 30-300 seconds depending on database size, but this is acceptable during
 * low-traffic hours.
 */
export default class DatabaseMaintenanceCronjob extends BaseCronjob {
  metadata = {
    name: "database-maintenance",
    description: "Daily database optimization (ANALYZE, VACUUM, PRAGMA optimize, WAL checkpoint)",
    schedule: "0 3 * * *", // 3 AM daily
    timeout: 600000, // 10 minutes max
  };

  async execute(): Promise<CronjobResult> {
    try {
      this.info("Starting daily database maintenance...");

      const sqlite = DatabaseConnection.getRawSqlite();
      if (!sqlite) {
        const error = "Database connection not available";
        this.error(error);
        return { success: false, error };
      }

      // 1. Run ANALYZE to update query planner statistics
      this.info("Running ANALYZE...");
      const analyzeStart = performance.now();
      sqlite.run("ANALYZE;");
      const analyzeTime = performance.now() - analyzeStart;
      this.info(`ANALYZE completed in ${analyzeTime.toFixed(0)}ms`);

      // 2. Get database stats before VACUUM
      const statsBefore = sqlite.query("PRAGMA page_count").get() as any;
      const pageSize = sqlite.query("PRAGMA page_size").get() as any;
      const pagesBefore = Object.values(statsBefore)[0] as number;
      const pageSizeBytes = Object.values(pageSize)[0] as number;
      const sizeMBBefore = (pagesBefore * pageSizeBytes) / (1024 * 1024);

      this.info(`Database size before VACUUM: ${sizeMBBefore.toFixed(2)} MB`);

      // 3. Run VACUUM to reclaim free space and defragment
      this.info("Running VACUUM (this will block the database for 30-300s)...");
      const vacuumStart = performance.now();
      sqlite.run("VACUUM;");
      const vacuumTime = performance.now() - vacuumStart;

      // 4. Get database stats after VACUUM
      const statsAfter = sqlite.query("PRAGMA page_count").get() as any;
      const pagesAfter = Object.values(statsAfter)[0] as number;
      const sizeMBAfter = (pagesAfter * pageSizeBytes) / (1024 * 1024);
      const savedMB = sizeMBBefore - sizeMBAfter;
      const savedPercent = (savedMB / sizeMBBefore) * 100;

      this.info(
        `VACUUM completed in ${(vacuumTime / 1000).toFixed(1)}s. ` +
        `Size: ${sizeMBAfter.toFixed(2)} MB (saved ${savedMB.toFixed(2)} MB, ${savedPercent.toFixed(1)}%)`
      );

      // 5. Run PRAGMA optimize (lightweight, runs recommended optimizations)
      this.info("Running PRAGMA optimize...");
      sqlite.run("PRAGMA optimize;");
      this.info("PRAGMA optimize completed");

      // 6. Checkpoint WAL to prevent it from growing too large
      this.info("Checkpointing WAL...");
      const checkpoint = sqlite.query("PRAGMA wal_checkpoint(TRUNCATE)").get();
      this.info(`WAL checkpoint: ${JSON.stringify(checkpoint)}`);

      const message = `Database optimized: ${sizeMBAfter.toFixed(2)} MB (reclaimed ${savedMB.toFixed(2)} MB)`;
      this.info(message);

      return {
        success: true,
        message,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.error(`Database maintenance failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }
}
