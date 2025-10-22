import { BaseCommand } from "../../../src/commands/base-command";
import { CronjobScheduler } from "../../../src/scheduler/cronjob-scheduler";
import { logger } from "../../../src/utils/logger";

/**
 * Cronjobs Run Command
 *
 * Starts the cronjob scheduler to run periodic tasks.
 * This should run separately from the web server to avoid interference.
 *
 * The cronjob scheduler will:
 * - Run cache cleanup tasks
 * - Run entity refresh tasks
 * - Run price fetching tasks
 * - Execute other scheduled maintenance
 *
 * Usage:
 *   bun cli cronjobs:run
 */
export default class CronjobsRunCommand extends BaseCommand {
  override name = "cronjobs:run";
  override description = "Start the cronjob scheduler for periodic tasks";
  override usage = "cronjobs:run";

  private scheduler: CronjobScheduler | null = null;

  override async execute(args: string[]): Promise<void> {
    this.info("🕐 Starting Cronjob Scheduler");
    this.info("━".repeat(50));
    this.info("");
    this.info("Press Ctrl+C to stop");
    this.info("");

    // Handle graceful shutdown
    let running = true;
    const shutdown = async () => {
      if (!running) return;
      running = false;

      this.info("");
      this.warn("🛑 Shutting down cronjob scheduler...");

      try {
        if (this.scheduler) {
          await this.scheduler.stop();
          this.success("✅ Cronjob scheduler stopped gracefully");
        }
        process.exit(0);
      } catch (error) {
        this.error(`❌ Error stopping cronjob scheduler: ${error}`);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    try {
      // Create and start scheduler
      this.info("🔍 Discovering cronjobs...");
      this.scheduler = new CronjobScheduler();
      await this.scheduler.discover();

      this.info("🕐 Starting scheduler...");
      this.scheduler.start();

      this.success("✅ Cronjob scheduler started successfully");
      this.info("");
      this.info("💡 Scheduled tasks are now running...");

      // Keep the process alive
      await new Promise(() => {
        // This promise never resolves, keeping the process running
        // until SIGINT/SIGTERM is received
      });
    } catch (error) {
      this.error(`❌ Failed to start cronjob scheduler: ${error}`);
      process.exit(1);
    }
  }

  override showHelp(): void {
    console.log(`
${this.name} - ${this.description}

Usage:
  bun cli ${this.name}

Options:
  --help    Show this help message

Description:
  Starts the cronjob scheduler to run periodic maintenance tasks.
  This command should be run separately from the web server to prevent
  performance interference.

  Scheduled tasks include:
  - Cache cleanup (remove expired entries)
  - Entity refresh (update character/corp/alliance data)
  - Price fetching (update market prices)
  - Statistics aggregation
  - Database maintenance

  Cronjobs are defined in /app/cronjobs/ and use cron syntax
  for scheduling (e.g., "0 * * * *" for hourly).

Examples:
  bun cli ${this.name}    # Start the cronjob scheduler

Notes:
  - Run this in a separate terminal or process from the web server
  - Use a process manager (pm2, systemd) for production deployments
  - Check logs to see when each cronjob runs
  - Cronjobs are defined in app/cronjobs/*.ts files
`);
  }
}
