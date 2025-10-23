import { BaseCommand } from "../../../src/commands/base-command";
import { QueueManager } from "../../queue/queue-manager";
import { DatabaseConnection } from "../../../src/db";
import { KillmailFetcher } from "../../queue/killmail-fetcher";

/**
 * Killmail Queue Worker Command
 *
 * Starts worker for killmail-fetch queue only.
 * Processes killmail fetching from ESI/eve-kill.com.
 *
 * Usage:
 *   bun cli queue:work-killmails
 *   bun cli queue:work-killmails --concurrency=10
 */
export default class QueueWorkKillmailsCommand extends BaseCommand {
  override name = "queue:work-killmails";
  override description = "Start killmail-fetch queue worker";
  override usage = "queue:work-killmails [--concurrency=<number>]";

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const concurrency = parsedArgs.options["concurrency"]
      ? Number.parseInt(parsedArgs.options["concurrency"] as string)
      : undefined;

    this.info("🔄 Starting Killmail Queue Worker");
    this.info("━".repeat(50));
    this.info("");
    this.info(`📋 Queue: killmail-fetch`);
    if (concurrency) {
      this.info(`   Concurrency: ${concurrency}`);
    } else {
      this.info(`   Concurrency: 5 (default)`);
    }
    this.info("");
    this.info("Press Ctrl+C to stop");
    this.info("");

    // Create queue manager
    const queueManager = new QueueManager(DatabaseConnection.getQueueInstance());

    // Register worker with optional concurrency override
    const worker = new KillmailFetcher();
    if (concurrency) {
      worker.concurrency = concurrency;
    }
    queueManager.registerWorker(worker);

    // Handle graceful shutdown
    let running = true;
    const shutdown = async () => {
      if (!running) return;
      running = false;

      this.info("");
      this.warn("🛑 Shutting down killmail worker...");

      try {
        await queueManager.stop();
        this.success("✅ Worker stopped gracefully");
        process.exit(0);
      } catch (error) {
        this.error(`❌ Error stopping worker: ${error}`);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    try {
      this.info("🔄 Starting worker...");
      await queueManager.start();
      this.success("✅ Worker started");
      this.info("");

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      this.error(`❌ Failed to start worker: ${error}`);
      process.exit(1);
    }
  }

  override showHelp(): void {
    console.log(`
${this.name} - ${this.description}

Usage:
  bun cli ${this.name} [options]

Options:
  --concurrency=<number>   Override default concurrency (default: 5)
  --help                   Show this help message

Description:
  Starts the killmail-fetch queue worker only.
  Fetches killmail data from eve-kill.com/ESI and stores in database.

Examples:
  bun cli ${this.name}                    # Start with default concurrency (5)
  bun cli ${this.name} --concurrency=10   # Start with 10 concurrent jobs
`);
  }
}
