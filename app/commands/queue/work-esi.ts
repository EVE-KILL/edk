import { BaseCommand } from "../../../src/commands/base-command";
import { QueueManager } from "../../queue/queue-manager";
import { DatabaseConnection } from "../../../src/db";
import { ESIFetcher } from "../../queue/esi-fetcher";

/**
 * ESI Queue Worker Command
 *
 * Starts worker for esi queue only.
 * Processes character/corporation/alliance data fetching.
 *
 * Usage:
 *   bun cli queue:work-esi
 *   bun cli queue:work-esi --concurrency=20
 */
export default class QueueWorkESICommand extends BaseCommand {
  override name = "queue:work-esi";
  override description = "Start ESI queue worker";
  override usage = "queue:work-esi [--concurrency=<number>]";

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const concurrency = parsedArgs.options["concurrency"]
      ? Number.parseInt(parsedArgs.options["concurrency"] as string)
      : undefined;

    this.info("🔄 Starting ESI Queue Worker");
    this.info("━".repeat(50));
    this.info("");
    this.info(`📋 Queue: esi`);
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
    const worker = new ESIFetcher();
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
      this.warn("🛑 Shutting down ESI worker...");

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
  Starts the ESI queue worker only.
  Fetches character, corporation, and alliance data from eve-kill.com/ESI.

Examples:
  bun cli ${this.name}                    # Start with default concurrency (10)
  bun cli ${this.name} --concurrency=20   # Start with 20 concurrent jobs
`);
  }
}
