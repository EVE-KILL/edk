import { BaseCommand } from "../../../src/commands/base-command";
import { BaseESIService } from "../../../services/esi/base-service";

/**
 * ESI Cache Cleaner Command
 * Removes expired ESI cache entries from database
 */
export default class ESICacheCleanCommand extends BaseCommand {
  name = "esi:cache-clean";
  description = "Clean expired ESI cache entries";
  usage = "esi:cache-clean [options]";
  examples = [
    "bun cli esi:cache-clean           # Clean expired cache entries",
    "bun cli esi:cache-clean --force   # Skip confirmation",
  ];

  async execute(args: string[]): Promise<void> {
    const { flags } = this.parseArgs(args);

    if (!flags.force) {
      const confirmed = await this.confirm(
        "Clean expired ESI cache entries?",
        true
      );

      if (!confirmed) {
        this.info("Cache cleaning cancelled");
        return;
      }
    }

    this.info("Cleaning expired ESI cache entries...");

    try {
      const count = await BaseESIService.clearExpiredCache();
      this.success(`Cleaned ${count} expired ESI cache entries!`);
    } catch (error) {
      this.error(
        `Failed to clean cache: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      process.exit(1);
    }
  }
}
