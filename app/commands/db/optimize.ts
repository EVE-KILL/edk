import { BaseCommand } from "../../../src/commands/base-command";
import { DatabaseConnection } from "../../../src/db";
import { logger } from "../../../src/utils/logger";

export default class OptimizeCommand extends BaseCommand {
  name = "db:optimize";
  description = "Optimize the database (ANALYZE, VACUUM, statistics)";
  usage = "db:optimize";

  async execute(): Promise<void> {
    logger.info("Starting database optimization...");

    const sqlite = DatabaseConnection.getRawSqlite();
    if (!sqlite) {
      logger.error("Database connection not available");
      return;
    }

    try {
      // 1. Run ANALYZE to update query planner statistics
      logger.info("Running ANALYZE to update query statistics...");
      const analyzeStart = performance.now();
      sqlite.run("ANALYZE;");
      const analyzeTime = performance.now() - analyzeStart;
      logger.success(`ANALYZE completed in ${analyzeTime.toFixed(0)}ms`);

      // 2. Get database stats before VACUUM
      const statsBefore = sqlite.query("PRAGMA page_count").get() as any;
      const pageSize = sqlite.query("PRAGMA page_size").get() as any;
      const pagesBefore = Object.values(statsBefore)[0] as number;
      const pageSizeBytes = Object.values(pageSize)[0] as number;
      const sizeMBBefore = (pagesBefore * pageSizeBytes) / (1024 * 1024);

      logger.info(
        `Database size before VACUUM: ${sizeMBBefore.toFixed(2)} MB (${pagesBefore.toLocaleString()} pages)`
      );

      // 3. Run VACUUM to reclaim free space and defragment
      logger.info("Running VACUUM to reclaim space and defragment...");
      logger.warn("This may take a while for large databases...");
      const vacuumStart = performance.now();
      sqlite.run("VACUUM;");
      const vacuumTime = performance.now() - vacuumStart;

      // 4. Get database stats after VACUUM
      const statsAfter = sqlite.query("PRAGMA page_count").get() as any;
      const pagesAfter = Object.values(statsAfter)[0] as number;
      const sizeMBAfter = (pagesAfter * pageSizeBytes) / (1024 * 1024);

      const savedMB = sizeMBBefore - sizeMBAfter;
      const savedPercent = (savedMB / sizeMBBefore) * 100;

      logger.success(
        `VACUUM completed in ${(vacuumTime / 1000).toFixed(1)}s`
      );
      logger.info(
        `Database size after VACUUM: ${sizeMBAfter.toFixed(2)} MB (${pagesAfter.toLocaleString()} pages)`
      );
      logger.success(
        `Space reclaimed: ${savedMB.toFixed(2)} MB (${savedPercent.toFixed(1)}%)`
      );

      // 5. Run PRAGMA optimize to update recommendations
      logger.info("Running PRAGMA optimize...");
      sqlite.run("PRAGMA optimize;");
      logger.success("PRAGMA optimize completed");

      // 6. Checkpoint WAL
      logger.info("Checkpointing WAL...");
      const checkpoint = sqlite.query("PRAGMA wal_checkpoint(TRUNCATE)").get();
      logger.success(`WAL checkpoint: ${JSON.stringify(checkpoint)}`);

      logger.success("Database optimization complete!");

      // 7. Show current PRAGMA settings
      logger.info("\nCurrent PRAGMA settings:");
      const pragmas = [
        "cache_size",
        "mmap_size",
        "page_size",
        "synchronous",
        "temp_store",
        "wal_autocheckpoint",
      ];

      for (const pragma of pragmas) {
        const result = sqlite.query(`PRAGMA ${pragma}`).get() as any;
        logger.info(`  ${pragma}: ${Object.values(result)[0]}`);
      }

    } catch (error) {
      logger.error("Database optimization failed:", error);
      throw error;
    }
  }
}
