import { CronParser } from "./cron-parser";
import { BaseCronjob } from "./base-cronjob";
import { logger } from "../utils/logger";
import { promises as fs } from "fs";
import { extname, resolve } from "path";

interface LoadedCronjob {
  cronjob: BaseCronjob;
  name: string;
  schedule: string;
}

/**
 * Cronjob Scheduler - Manages scheduled task execution
 *
 * Discovers cronjob implementations from /app/cronjobs directory
 * and executes them on their specified schedules
 */
export class CronjobScheduler {
  private cronjobs: LoadedCronjob[] = [];
  private running = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private pollIntervalMs = 60000; // Check every 60 seconds (at minute boundaries)
  private lastMinute = -1;

  /**
   * Discover and load all cronjobs from /app/cronjobs
   */
  async discover() {
    const cronjobsDir = resolve(process.cwd(), "app/cronjobs");

    try {
      const files = await fs.readdir(cronjobsDir);
      const tsFiles = files.filter(
        (f) => extname(f) === ".ts" || extname(f) === ".js"
      );

      logger.info(`📂 Discovering cronjobs in ${cronjobsDir}...`);

      for (const file of tsFiles) {
        try {
          const filePath = resolve(cronjobsDir, file);
          // Dynamic import with cache busting
          const imported = await import(`file://${filePath}?t=${Date.now()}`);

          // Look for default export or named export
          const CronjobClass = imported.default || Object.values(imported)[0];

          if (!CronjobClass) {
            logger.warn(`  ⚠️  ${file}: No default export found`);
            continue;
          }

          // Instantiate the cronjob
          const instance = new CronjobClass();

          if (!(instance instanceof BaseCronjob)) {
            logger.warn(
              `  ⚠️  ${file}: Does not extend BaseCronjob, skipping`
            );
            continue;
          }

          this.cronjobs.push({
            cronjob: instance,
            name: instance.metadata.name,
            schedule: instance.metadata.schedule,
          });

          logger.success(`  ✓ ${file}: ${instance.metadata.description}`);
        } catch (error) {
          logger.error(
            `  ✗ ${file}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      if (this.cronjobs.length === 0) {
        logger.warn("No cronjobs discovered");
        return;
      }

      logger.success(`✅ Discovered ${this.cronjobs.length} cronjob(s)`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.warn(`Cronjobs directory does not exist: ${cronjobsDir}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.running) {
      logger.warn("Cronjob scheduler already running");
      return;
    }

    if (this.cronjobs.length === 0) {
      logger.info("No cronjobs to schedule");
      return;
    }

    this.running = true;

    // Initial check
    this.checkAndExecute();

    // Poll every 60 seconds to check for tasks at minute boundaries
    this.pollingInterval = setInterval(
      () => this.checkAndExecute(),
      this.pollIntervalMs
    );

    logger.success(
      `🕐 Cronjob scheduler started with ${this.cronjobs.length} cronjob(s)`
    );

    // Log schedule
    for (const job of this.cronjobs) {
      logger.info(`  ├─ ${job.name}: ${job.schedule}`);
    }
    logger.info(`  └─ (running ${this.cronjobs.length} cronjob(s))`);
  }

  /**
   * Stop the scheduler
   */
  async stop() {
    if (!this.running) {
      return;
    }

    logger.info("🛑 Stopping cronjob scheduler...");
    this.running = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    logger.success("✅ Cronjob scheduler stopped");
  }

  /**
   * Check if any cronjobs should run and execute them
   */
  private async checkAndExecute() {
    if (!this.running) return;

    const now = new Date();
    const currentMinute = now.getMinutes();

    // Only check once per minute
    if (currentMinute === this.lastMinute) {
      return;
    }

    this.lastMinute = currentMinute;

    for (const job of this.cronjobs) {
      try {
        const parser = new CronParser(job.schedule);

        if (parser.matches(now)) {
          logger.info(`🚀 Running cronjob: ${job.name}`);

          const startTime = performance.now();
          const timeout = job.cronjob.metadata.timeout || 300000; // Default 5 minutes

          try {
            const result = await Promise.race([
              job.cronjob.execute(),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Cronjob timeout after ${timeout}ms`
                      )
                    ),
                  timeout
                )
              ),
            ]);

            const duration = Math.round(performance.now() - startTime);

            if (result.success) {
              logger.success(
                `✅ ${job.name} completed in ${duration}ms: ${result.message || ""}`
              );
            } else {
              logger.error(
                `❌ ${job.name} failed: ${result.error || result.message || "Unknown error"}`
              );
            }
          } catch (error) {
            const duration = Math.round(performance.now() - startTime);
            logger.error(
              `❌ ${job.name} error after ${duration}ms: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }
      } catch (error) {
        logger.error(
          `❌ Error scheduling ${job.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  }
}
