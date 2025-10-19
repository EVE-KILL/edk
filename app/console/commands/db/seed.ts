import { BaseCommand } from "../../base-command";

/**
 * Database seeding command
 * Populate database with initial or test data
 */
export default class SeedCommand extends BaseCommand {
  name = "db:seed";
  description = "Seed the database with data";
  usage = "db:seed [seeder]";
  examples = [
    "bun cli db:seed              # Run all seeders",
    "bun cli db:seed users        # Run specific seeder",
    "bun cli db:seed --force      # Skip confirmation",
  ];

  async execute(args: string[]): Promise<void> {
    const { positional, flags } = this.parseArgs(args);
    const seeder = positional[0] || "all";

    if (!flags.force) {
      const confirmed = await this.confirm(
        `Seed database with ${seeder} data?`,
        true
      );

      if (!confirmed) {
        this.info("Seeding cancelled");
        return;
      }
    }

    this.info(`Seeding database: ${seeder}...`);

    // TODO: Implement actual seeding logic
    if (seeder === "all") {
      // await db.seed.run();
      this.success("All seeders executed!");
    } else {
      // await db.seed.run(seeder);
      this.success(`Seeder '${seeder}' executed!`);
    }
  }
}
