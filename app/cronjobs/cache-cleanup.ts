import { BaseCronjob, type CronjobResult } from "../../src/scheduler/base-cronjob";

/**
 * Example: Cache Cleanup Cronjob
 * Runs every 6 hours to clean up old cache entries
 *
 * Usage: Create similar files in /app/cronjobs to add more scheduled tasks
 */
export default class CacheCleanupCronjob extends BaseCronjob {
  metadata = {
    name: "cache-cleanup",
    description: "Clean cache of expired entries",
    schedule: "* * * * *", // Every 6 hours
    timeout: 60000, // 1 minute max
  };

  async execute(): Promise<CronjobResult> {
    try {
      this.info("Starting cache cleanup...");

      // Example cleanup logic
      const itemsRemoved = Math.floor(Math.random() * 100); // Simulated
      this.info(`Removed ${itemsRemoved} old cache entries`);

      return {
        success: true,
        message: `Cleaned up ${itemsRemoved} cache entries`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.error(`Failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }
}
