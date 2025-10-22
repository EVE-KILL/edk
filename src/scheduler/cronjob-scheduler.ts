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
      const tsFiles = files.filter((f) => extname(f) === ".ts" || extname(f) === ".js");

      for (const file of tsFiles) {
        try {
          const filePath = resolve(cronjobsDir, file);
          const imported = await import(`file://${filePath}?t=${Date.now()}`);
          const CronjobClass = imported.default || Object.values(imported)[0];

          if (!CronjobClass) continue;

          const instance = new CronjobClass();

          if (!(instance instanceof BaseCronjob)) continue;

          this.cronjobs.push({
            cronjob: instance,
            name: instance.metadata.name,
            schedule: instance.metadata.schedule,
          });
        } catch (error) {
          logger.error(`Failed to load cronjob ${file}:`, error);
        }
      }

      if (this.cronjobs.length === 0) {
        logger.warn("No cronjobs discovered");
        return;
      }

      logger.success(`Discovered ${this.cronjobs.length} cronjob(s)`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.warn(`Cronjobs directory not found: ${cronjobsDir}`);
      } else {
        throw error;
      }
    }
  }

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
    this.checkAndExecute();

    this.pollingInterval = setInterval(
      () => this.checkAndExecute(),
      this.pollIntervalMs
    );

    logger.success(`Cronjob scheduler started (${this.cronjobs.length} cronjob(s))`);
  }

  /**
   * Stop the scheduler
   */
  async stop() {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
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
          const startTime = performance.now();
          const timeout = job.cronjob.metadata.timeout || 300000;

          try {
            const result = await Promise.race([
              job.cronjob.execute(),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error(`Cronjob timeout after ${timeout}ms`)),
                  timeout
                )
              ),
            ]);

            const duration = Math.round(performance.now() - startTime);

            if (result.success) {
              logger.success(`${job.name} completed in ${duration}ms`);
            } else {
              logger.error(`${job.name} failed: ${result.error || ""}`);
            }
          } catch (error) {
            const duration = Math.round(performance.now() - startTime);
            logger.error(`${job.name} error: ${error instanceof Error ? error.message : "Unknown"}`);
          }
        }
      } catch (error) {
        logger.error(`Error scheduling ${job.name}: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    }
  }
}
