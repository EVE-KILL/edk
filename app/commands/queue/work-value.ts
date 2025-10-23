import { BaseCommand } from "../../../src/commands/base-command";
import { QueueManager } from "../../queue/queue-manager";
import { DatabaseConnection } from "../../../src/db";
import { KillmailValueUpdater } from "../../queue/killmail-value-updater";

/**
 * Killmail Value Queue Worker Command (Alias)
 *
 * This is an alias for work-killmail-value for backward compatibility.
 * Both commands run the same KillmailValueUpdater worker.
 *
 * Usage:
 *   bun cli queue:work-value
 *   bun cli queue:work-value --concurrency=15
 */
export default class QueueWorkValueCommand extends BaseCommand {
  override name = "queue:work-value";
  override description = "Start killmail-value queue worker (alias)";
  override usage = "queue:work-value [--concurrency=<number>]";

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const concurrency = parsedArgs.options["concurrency"]
      ? Number.parseInt(parsedArgs.options["concurrency"] as string)
      : undefined;

    this.info("🔄 Starting Killmail Value Queue Worker");
    this.info("━".repeat(50));
    this.info("");
    this.info(`📋 Queue: killmail-value`);
    if (concurrency) {
      this.info(`   Concurrency: ${concurrency}`);
    } else {
      this.info(`   Concurrency: 10 (default)`);
    }
    this.info("");
    this.info("Press Ctrl+C to stop");
    this.info("");

    // Create queue manager
    const queueManager = new QueueManager(DatabaseConnection.getQueueInstance());

    // Register worker with optional concurrency override
    const worker = new KillmailValueUpdater();
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
      this.warn("🛑 Shutting down killmail value worker...");

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
  --concurrency=<number>   Override default concurrency (default: 10)
  --help                   Show this help message

Description:
  Starts the killmail-value queue worker.
  This is an alias for 'queue:work-killmail-value'.

  Fetches prices for killmail items and calculates ISK values.

  This worker:
  - Uses LRU cache for prices (fast repeated lookups)
  - Fetches prices from eve-kill.com API when not cached
  - Calculates ship, fitted, dropped, destroyed, and total values
  - Updates killmail records with final ISK values

Examples:
  bun cli ${this.name}                    # Start with default concurrency (10)
  bun cli ${this.name} --concurrency=15   # Start with 15 concurrent jobs

Note:
  This command is equivalent to 'queue:work-killmail-value'.
`);
  }
}
