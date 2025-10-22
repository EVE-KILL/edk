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
      logger.info("Running ANALYZE...");
      const analyzeStart = performance.now();
      sqlite.run("ANALYZE;");
      const analyzeTime = performance.now() - analyzeStart;
      logger.success(`ANALYZE completed in ${analyzeTime.toFixed(0)}ms`);

      const statsBefore = sqlite.query("PRAGMA page_count").get() as any;
      const pageSize = sqlite.query("PRAGMA page_size").get() as any;
      const pagesBefore = Object.values(statsBefore)[0] as number;
      const pageSizeBytes = Object.values(pageSize)[0] as number;
      const sizeMBBefore = (pagesBefore * pageSizeBytes) / (1024 * 1024);

      logger.info(`Database size before VACUUM: ${sizeMBBefore.toFixed(2)} MB (${pagesBefore.toLocaleString()} pages)`);

      logger.warn("Running VACUUM...");
      const vacuumStart = performance.now();
      sqlite.run("VACUUM;");
      const vacuumTime = performance.now() - vacuumStart;

      const statsAfter = sqlite.query("PRAGMA page_count").get() as any;
      const pagesAfter = Object.values(statsAfter)[0] as number;
      const sizeMBAfter = (pagesAfter * pageSizeBytes) / (1024 * 1024);

      const savedMB = sizeMBBefore - sizeMBAfter;
      const savedPercent = (savedMB / sizeMBBefore) * 100;

      logger.success(`VACUUM completed in ${(vacuumTime / 1000).toFixed(1)}s`);
      logger.info(`Database size after VACUUM: ${sizeMBAfter.toFixed(2)} MB (${pagesAfter.toLocaleString()} pages)`);
      logger.success(`Space reclaimed: ${savedMB.toFixed(2)} MB (${savedPercent.toFixed(1)}%)`);

      logger.info("Running PRAGMA optimize...");
      sqlite.run("PRAGMA optimize;");
      logger.success("PRAGMA optimize completed");

      logger.info("Checkpointing WAL...");
      const checkpoint = sqlite.query("PRAGMA wal_checkpoint(TRUNCATE)").get();
      logger.success(`WAL checkpoint: ${JSON.stringify(checkpoint)}`);

      logger.success("Database optimization complete!");

      logger.info("\nCurrent PRAGMA settings:");
      const pragmas = ["cache_size", "mmap_size", "page_size", "synchronous", "temp_store", "wal_autocheckpoint"];
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

