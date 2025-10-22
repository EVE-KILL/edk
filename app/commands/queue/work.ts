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
 * - Process ESI data fetching jobs
 * - Process price calculation jobs
 * - Process value calculation jobs
 * - Handle retries and failures
 *
 * Usage:
 *   bun cli queue:work
 *   bun cli queue:work --concurrency=5
 */
export default class QueueWorkCommand extends BaseCommand {
  override name = "queue:work";
  override description = "Start queue workers to process background jobs";
  override usage = "queue:work [--concurrency=<number>]";

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);

    // Optional: Allow overriding concurrency via CLI
    const concurrency = parsedArgs.options["concurrency"]
      ? Number.parseInt(parsedArgs.options["concurrency"] as string)
      : undefined;

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

    if (concurrency) {
      this.info(`   Concurrency: ${concurrency}`);
      // Note: You'd need to add concurrency support to queueManager.start()
      // For now, this is just informational
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
  --concurrency=<number>   Number of concurrent workers per queue (future feature)
  --help                   Show this help message

Description:
  Starts background queue workers to process jobs asynchronously.
  This command should be run separately from the web server to prevent
  performance interference.

  The queue workers process:
  - Killmail fetching from ESI
  - Character/Corporation/Alliance data fetching
  - Price data updates
  - ISK value calculations

  Workers poll the database for pending jobs and process them with
  automatic retry logic on failures.

Examples:
  bun cli ${this.name}                    # Start with default settings
  bun cli ${this.name} --concurrency=10   # Start with 10 workers per queue (future)

Notes:
  - Run this in a separate terminal or process from the web server
  - Use a process manager (pm2, systemd) for production deployments
  - Monitor queue stats via: bun cli queue:stats (if implemented)
`);
  }
}
