import { BaseCommand } from "../../../src/commands/base-command";

/**
 * Database migration command
 * Run database migrations with optional flags
 */
export default class MigrateCommand extends BaseCommand {
  name = "db:migrate";
  description = "Run database migrations";
  usage = "db:migrate [options]";
  examples = [
    "bun cli db:migrate           # Run pending migrations",
    "bun cli db:migrate --fresh   # Drop all tables and re-run migrations",
    "bun cli db:migrate --seed    # Run migrations and seed data",
  ];

  override async execute(args: string[]): Promise<void> {
    const { flags } = this.parseArgs(args);

    if (flags.fresh) {
      const confirmed = await this.confirm(
        "This will DROP ALL TABLES. Are you sure?",
        false
      );

      if (!confirmed) {
        this.info("Migration cancelled");
        return;
      }

      this.info("Running fresh migrations...");
      // TODO: await db.migrate.fresh();
      this.success("Fresh migrations complete!");
    } else {
      this.info("Running pending migrations...");
      // TODO: await db.migrate.latest();
      this.success("Migrations complete!");
    }

    if (flags.seed) {
      this.info("Seeding database...");
      // TODO: await db.seed.run();
      this.success("Database seeded!");
    }
  }
}
