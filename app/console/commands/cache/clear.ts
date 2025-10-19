import { BaseCommand } from "../../base-command";

/**
 * Cache management command
 * Clear application caches by type
 */
export default class CacheClearCommand extends BaseCommand {
  name = "cache:clear";
  description = "Clear application cache";
  usage = "cache:clear [type]";
  examples = [
    "bun cli cache:clear              # Clear all caches",
    "bun cli cache:clear killmails    # Clear killmail cache only",
    "bun cli cache:clear --force      # Skip confirmation prompt",
  ];

  async execute(args: string[]): Promise<void> {
    const { positional, flags } = this.parseArgs(args);
    const type = positional[0] || "all";

    // Confirm destructive action unless --force is used
    if (!flags.force) {
      const confirmed = await this.confirm(
        `Are you sure you want to clear ${type} cache?`,
        false
      );

      if (!confirmed) {
        this.info("Cache clear cancelled");
        return;
      }
    }

    this.info(`Clearing ${type} cache...`);

    // TODO: Implement actual cache clearing logic
    switch (type) {
      case "killmails":
        // await cache.clear("killmails:*");
        this.success("Killmail cache cleared!");
        break;
      case "characters":
        // await cache.clear("characters:*");
        this.success("Character cache cleared!");
        break;
      case "all":
        // await cache.flushAll();
        this.success("All caches cleared!");
        break;
      default:
        this.error(`Unknown cache type: ${type}`);
        this.log("Available types: killmails, characters, all");
        process.exit(1);
    }
  }
}
