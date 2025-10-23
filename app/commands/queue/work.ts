import { BaseCommand } from "../../../src/commands/base-command";
import { queueManager } from "../../queue/queue-manager";
import { logger } from "../../../src/utils/logger";

/**
 * Queue Work Command
 *
 * Starts queue workers to process background jobs.
 * This should run separately from the web server to avoid interference.
 *
 * The queue workers will:
 * - Process killmail fetching jobs
 * - Process killmail value calculation jobs (prices + ISK values)
 * - Process ESI data fetching jobs
 * - Process price calculation jobs
 * - Handle retries and failures
 *
 * Each worker has its own concurrency settings:
 * - KillmailFetcher: 5 concurrent jobs
 * - KillmailValueUpdater: 10 concurrent jobs
 * - ESIFetcher: 10 concurrent jobs
 * - TypeFetcher: 5 concurrent jobs
 *
 * Usage:
 *   bun cli queue:work
 */
export default class QueueWorkCommand extends BaseCommand {
  override name = "queue:work";
  override description = "Start queue workers to process background jobs";
  override usage = "queue:work";

  override async execute(args: string[]): Promise<void> {
    this.info("🔄 Starting Queue Workers");
    this.info("━".repeat(50));
    this.info("");

    const logLevel = process.env.LOG_LEVEL || "info";
    this.info(`📋 Configuration:`);
    this.info(`   Log Level: ${logLevel}`);
    if (logLevel === "info") {
      this.info(`   Output: Summary stats every 30 seconds`);
      this.info(`   💡 For detailed logs: LOG_LEVEL=debug bun cli queue:work`);
    } else if (logLevel === "debug") {
      this.info(`   Output: Detailed logs for every job`);
    }
    this.info("");

    this.info("Press Ctrl+C to stop");
    this.info("");

    // Handle graceful shutdown
    let running = true;
    const shutdown = async () => {
      if (!running) return;
      running = false;

      this.info("");
      this.warn("🛑 Shutting down queue workers...");

      try {
        await queueManager.stop();
        this.success("✅ Queue workers stopped gracefully");
        process.exit(0);
      } catch (error) {
        this.error(`❌ Error stopping queue workers: ${error}`);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    try {
      // Start queue manager
      this.info("🔄 Initializing queue workers...");
      await queueManager.start();
      this.success("✅ Queue workers started successfully");
      this.info("");
      this.info("💡 Monitoring queues for jobs...");

      // Keep the process alive
      await new Promise(() => {
        // This promise never resolves, keeping the process running
        // until SIGINT/SIGTERM is received
      });
    } catch (error) {
      this.error(`❌ Failed to start queue workers: ${error}`);
      process.exit(1);
    }
  }

  override showHelp(): void {
    console.log(`
${this.name} - ${this.description}

Usage:
  bun cli ${this.name} [options]

Options:
  --help                   Show this help message

Description:
  Starts background queue workers to process jobs asynchronously.
  This command should be run separately from the web server to prevent
  performance interference.

  The queue workers process:
  - Killmail fetching from eve-kill.com/ESI
  - Killmail value calculations (fetches prices and calculates ISK values)
  - Character/Corporation/Alliance data fetching
  - Price data updates

  Workers poll the database for pending jobs and process them with
  automatic retry logic on failures.

  Each worker has its own concurrency settings defined in the worker class:
  - KillmailFetcher: 5 concurrent jobs
  - KillmailValueUpdater: 10 concurrent jobs (fast - uses LRU cache)
  - ESIFetcher: 10 concurrent jobs
  - TypeFetcher: 5 concurrent jobs

Examples:
  bun cli ${this.name}                    # Start with default settings

Notes:
  - Run this in a separate terminal or process from the web server
  - Use a process manager (pm2, systemd) for production deployments
  - Monitor queue stats via: bun cli queue:stats (if implemented)
`);
  }
}
