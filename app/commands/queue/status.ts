import { BaseCommand } from "../../../src/commands/base-command";
import { db } from "../../../src/db";
import { jobs } from "../../../db/schema";
import { sql, eq, and, lt } from "drizzle-orm";
import { logger } from "../../../src/utils/logger";

/**
 * Queue Status Command
 *
 * Real-time monitoring of queue status, similar to 'top' command.
 * Shows queue statistics, job counts, processing rates, and system info.
 *
 * Usage:
 *   bun cli queue:status
 *   bun cli queue:status --refresh=5
 */
export default class QueueStatusCommand extends BaseCommand {
  override name = "queue:status";
  override description = "Monitor queue status in real-time";
  override usage = "queue:status [--refresh=<seconds>] [--once]";

  private running = true;
  private stats: any = {};

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const refreshInterval = parsedArgs.options["refresh"]
      ? Number.parseInt(parsedArgs.options["refresh"] as string) * 1000
      : 2000; // Default: 2 seconds
    const runOnce = parsedArgs.flags["once"] === true;

    // Handle Ctrl+C
    process.on("SIGINT", () => {
      this.running = false;
      console.log("\n");
      process.exit(0);
    });

    if (runOnce) {
      await this.fetchAndDisplay();
    } else {
      // Clear screen and show initial data
      console.clear();
      await this.fetchAndDisplay();

      // Update periodically
      const interval = setInterval(async () => {
        if (!this.running) {
          clearInterval(interval);
          return;
        }
        console.clear();
        await this.fetchAndDisplay();
      }, refreshInterval);
    }

    // Keep process alive if not running once
    if (!runOnce) {
      await new Promise(() => {});
    }
  }

  private async fetchAndDisplay(): Promise<void> {
    try {
      // Fetch all stats
      await this.fetchQueueStats();
      await this.fetchRecentActivity();
      await this.fetchSystemInfo();

      // Display dashboard
      this.displayDashboard();
    } catch (error) {
      console.error(`Error fetching stats: ${error}`);
    }
  }

  private async fetchQueueStats(): Promise<void> {
    // Get counts by queue and status
    const queueStats = await db
      .select({
        queue: jobs.queue,
        status: jobs.status,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .groupBy(jobs.queue, jobs.status)
      .all();

    // Get failed jobs count
    const failedJobs = await db
      .select({
        queue: jobs.queue,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .where(eq(jobs.status, "failed"))
      .groupBy(jobs.queue)
      .all();

    // Get oldest pending job per queue
    const oldestPending = await db
      .select({
        queue: jobs.queue,
        oldestCreatedAt: sql<string>`min(${jobs.createdAt})`,
      })
      .from(jobs)
      .where(eq(jobs.status, "pending"))
      .groupBy(jobs.queue)
      .all();

    // Get processing jobs
    const processingJobs = await db
      .select({
        queue: jobs.queue,
        type: jobs.type,
        reservedAt: jobs.reservedAt,
      })
      .from(jobs)
      .where(eq(jobs.status, "processing"))
      .orderBy(jobs.reservedAt)
      .limit(10)
      .all();

    this.stats.queueStats = queueStats;
    this.stats.failedJobs = failedJobs;
    this.stats.oldestPending = oldestPending;
    this.stats.processingJobs = processingJobs;
  }

  private async fetchRecentActivity(): Promise<void> {
    // Get completed jobs in last minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentCompleted = await db
      .select({
        queue: jobs.queue,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.status, "completed"),
          sql`${jobs.processedAt} > ${oneMinuteAgo.toISOString()}`
        )
      )
      .groupBy(jobs.queue)
      .all();

    this.stats.recentCompleted = recentCompleted;
  }

  private async fetchSystemInfo(): Promise<void> {
    // Database size
    const dbStats = await db
      .select({
        totalJobs: sql<number>`count(*)`,
      })
      .from(jobs)
      .all();

    // Memory usage
    const memUsage = process.memoryUsage();

    this.stats.dbStats = dbStats[0];
    this.stats.memUsage = memUsage;
  }

  private displayDashboard(): void {
    const now = new Date().toLocaleString();

    // Header
    console.log("━".repeat(100));
    console.log(`  EVE-KILL Queue Status - ${now}`);
    console.log("━".repeat(100));
    console.log();

    // Queue Overview
    this.displayQueueOverview();
    console.log();

    // Processing Jobs
    this.displayProcessingJobs();
    console.log();

    // System Info
    this.displaySystemInfo();
    console.log();

    // Footer
    console.log("━".repeat(100));
    console.log("  Press Ctrl+C to exit");
  }

  private displayQueueOverview(): void {
    console.log("📊 QUEUE OVERVIEW");
    console.log("─".repeat(100));

    // Group stats by queue
    const queues = new Map<string, any>();

    for (const stat of this.stats.queueStats || []) {
      if (!queues.has(stat.queue)) {
        queues.set(stat.queue, {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          total: 0,
          recentRate: 0,
          oldestPending: null,
        });
      }

      const queue = queues.get(stat.queue)!;
      queue[stat.status] = Number(stat.count);
      queue.total += Number(stat.count);
    }

    // Add recent completion rate
    for (const recent of this.stats.recentCompleted || []) {
      const queue = queues.get(recent.queue);
      if (queue) {
        queue.recentRate = Number(recent.count);
      }
    }

    // Add oldest pending time
    for (const oldest of this.stats.oldestPending || []) {
      const queue = queues.get(oldest.queue);
      if (queue && oldest.oldestCreatedAt) {
        const age = Date.now() - new Date(oldest.oldestCreatedAt).getTime();
        queue.oldestPending = this.formatDuration(age);
      }
    }

    // Display table header
    console.log(
      "  Queue".padEnd(20) +
      "Pending".padStart(10) +
      "Processing".padStart(12) +
      "Failed".padStart(10) +
      "Rate/min".padStart(12) +
      "Oldest".padStart(15)
    );
    console.log("  " + "─".repeat(98));

    // Display each queue
    for (const [queueName, stats] of Array.from(queues).sort()) {
      const pending = stats.pending.toLocaleString();
      const processing = stats.processing.toLocaleString();
      const failed = stats.failed.toLocaleString();
      const rate = stats.recentRate.toLocaleString();
      const oldest = stats.oldestPending || "N/A";

      console.log(
        `  ${queueName.padEnd(18)}` +
        `${pending.padStart(10)}` +
        `${processing.padStart(12)}` +
        `${failed.padStart(10)}` +
        `${rate.padStart(12)}` +
        `${oldest.padStart(15)}`
      );
    }

    // Totals
    const totalPending = Array.from(queues.values()).reduce((sum, q) => sum + q.pending, 0);
    const totalProcessing = Array.from(queues.values()).reduce((sum, q) => sum + q.processing, 0);
    const totalFailed = Array.from(queues.values()).reduce((sum, q) => sum + q.failed, 0);
    const totalRate = Array.from(queues.values()).reduce((sum, q) => sum + q.recentRate, 0);

    console.log("  " + "─".repeat(98));
    console.log(
      `  ${"TOTAL".padEnd(18)}` +
      `${totalPending.toLocaleString().padStart(10)}` +
      `${totalProcessing.toLocaleString().padStart(12)}` +
      `${totalFailed.toLocaleString().padStart(10)}` +
      `${totalRate.toLocaleString().padStart(12)}`
    );
  }

  private displayProcessingJobs(): void {
    console.log("⚙️  CURRENTLY PROCESSING");
    console.log("─".repeat(100));

    const processing = this.stats.processingJobs || [];

    if (processing.length === 0) {
      console.log("  No jobs currently processing");
      return;
    }

    console.log(
      "  Queue".padEnd(20) +
      "Type".padEnd(25) +
      "Duration".padStart(15)
    );
    console.log("  " + "─".repeat(98));

    for (const job of processing) {
      const duration = job.reservedAt
        ? this.formatDuration(Date.now() - new Date(job.reservedAt).getTime())
        : "N/A";

      console.log(
        `  ${job.queue.padEnd(18)}` +
        `${(job.type || "N/A").padEnd(25)}` +
        `${duration.padStart(15)}`
      );
    }
  }

  private displaySystemInfo(): void {
    console.log("💻 SYSTEM INFO");
    console.log("─".repeat(100));

    const totalJobs = this.stats.dbStats?.totalJobs || 0;
    const memUsage = this.stats.memUsage || {};

    const heapUsed = this.formatBytes(memUsage.heapUsed || 0);
    const heapTotal = this.formatBytes(memUsage.heapTotal || 0);
    const rss = this.formatBytes(memUsage.rss || 0);

    console.log(`  Total Jobs: ${totalJobs.toLocaleString()}`);
    console.log(`  Memory: ${heapUsed} / ${heapTotal} (RSS: ${rss})`);
    console.log(`  Node: ${process.version}`);
    console.log(`  Uptime: ${this.formatDuration(process.uptime() * 1000)}`);
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  override showHelp(): void {
    console.log(`
${this.name} - ${this.description}

Usage:
  bun cli ${this.name} [options]

Options:
  --refresh=<seconds>   Update interval in seconds (default: 2)
  --once                Run once and exit (don't refresh)
  --help                Show this help message

Description:
  Displays real-time queue statistics similar to the 'top' command.

  Shows:
  - Queue overview (pending, processing, failed jobs per queue)
  - Processing rate (jobs/minute)
  - Currently processing jobs
  - System information (memory usage, uptime)
  - Oldest pending job age

  The dashboard auto-refreshes every 2 seconds by default.
  Press Ctrl+C to exit.

Examples:
  bun cli ${this.name}              # Monitor with 2s refresh
  bun cli ${this.name} --refresh=5  # Monitor with 5s refresh
  bun cli ${this.name} --once       # Show stats once and exit

Notes:
  - Run this while queue workers are processing jobs
  - Use --once for scripting/logging
  - Useful for monitoring backfill progress
`);
  }
}
