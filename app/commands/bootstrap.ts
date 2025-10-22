import { BaseCommand } from "../../src/commands/base-command";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "../../src/db";

/**
 * Bootstrap Command
 *
 * Sets up the entire EVE Kill system from scratch:
 * 1. Creates database and runs migrations
 * 2. Imports static game data (regions, constellations, systems, types, groups, categories)
 * 3. Ready to start importing killmails
 *
 * Usage:
 *   bun cli bootstrap
 *   bun cli bootstrap --skip-imports  # Only setup database, skip data imports
 */
export default class BootstrapCommand extends BaseCommand {
  override name = "bootstrap";
  override description = "Bootstrap the entire EVE Kill system";
  override usage = "bootstrap [--skip-imports]";

  override async execute(args: string[]): Promise<void> {
    const parsedArgs = this.parseArgs(args);
    const skipImports = parsedArgs.flags["skip-imports"] || false;

    this.info("🚀 EVE Kill Bootstrap");
    this.info("━".repeat(50));
    this.info("");

    // Step 1: Database setup
    await this.setupDatabase();

    // Step 2: Import static data (unless skipped)
    if (!skipImports) {
      await this.importStaticData();
    } else {
      this.info("⏭️  Skipping static data imports (--skip-imports flag)");
      this.info("");
    }

    // Step 3: Final instructions
    this.showNextSteps();
  }

  /**
   * Setup database and run migrations
   */
  private async setupDatabase(): Promise<void> {
    this.info("📊 Step 1: Database Setup");
    this.info("━".repeat(50));

    const DATABASE_PATH = process.env.DATABASE_PATH || "./data/ekv4.db";
    this.info(`Database path: ${DATABASE_PATH}`);

    // Create data directory if it doesn't exist
    const dataDir = DATABASE_PATH.substring(0, DATABASE_PATH.lastIndexOf("/"));
    if (dataDir) {
      const fs = require("fs");
      if (!fs.existsSync(dataDir)) {
        this.info(`Creating data directory: ${dataDir}`);
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }

    // Run migrations
    this.info("Running database migrations...");
    try {
      const sqlite = new Database(DATABASE_PATH, { create: true });
      const migrationDb = drizzle(sqlite);
      await migrate(migrationDb, { migrationsFolder: "./db/migrations" });
      sqlite.close();
      this.success("✅ Database migrations complete");
    } catch (error) {
      this.error(`❌ Migration failed: ${error}`);
      throw error;
    }

    this.info("");
  }

  /**
   * Import all static game data
   */
  private async importStaticData(): Promise<void> {
    this.info("📦 Step 2: Static Data Import");
    this.info("━".repeat(50));

    const imports = [
      { name: "Regions", command: "init:import-regions" },
      { name: "Constellations", command: "init:import-constellations" },
      { name: "Systems", command: "init:import-systems" },
      { name: "Categories", command: "init:import-categories" },
      { name: "Groups", command: "init:import-groups" },
      { name: "Types", command: "init:import-types" },
    ];

    for (const { name, command } of imports) {
      this.info(`Importing ${name}...`);
      try {
        // Dynamically import and run the command
        const commandPath = `./init/${command.replace("init:", "")}.ts`;
        const module = await import(commandPath);
        const CommandClass = module.default;
        const commandInstance = new CommandClass();
        await commandInstance.execute([]);
        this.success(`✅ ${name} imported`);
      } catch (error) {
        this.error(`❌ Failed to import ${name}: ${error}`);
        throw error;
      }
    }

    this.info("");
  }

  /**
   * Show next steps after bootstrap
   */
  private showNextSteps(): void {
    this.success("🎉 Bootstrap Complete!");
    this.info("");
    this.info("━".repeat(50));
    this.info("📋 Next Steps:");
    this.info("━".repeat(50));
    this.info("");
    this.info("1. Configure your followed entities in .env:");
    this.info("   FOLLOWED_CHARACTER_IDS=12345,67890");
    this.info("   FOLLOWED_CORPORATION_IDS=98765432");
    this.info("   FOLLOWED_ALLIANCE_IDS=99003581");
    this.info("");
    this.info("2. Import killmails:");
    this.info("");
    this.info("   Option A - Backfill historical data first:");
    this.info("   bun cli backfill");
    this.info("   (Fetches all historical killmails from EVE-KILL)");
    this.info("");
    this.info("   Option B - Start real-time import only:");
    this.info("   bun cli redisq");
    this.info("   (Listens for new killmails from zkillboard)");
    this.info("");
    this.info("   Recommended: Run backfill first, then start redisq");
    this.info("");
    this.info("   (Note: If you set FOLLOWED_* entities, only");
    this.info("   killmails involving those entities will be imported)");
    this.info("");
    this.info("3. Start the web server:");
    this.info("   bun index.ts");
    this.info("");
    this.info("4. Visit your killboard:");
    this.info("   http://localhost:3000");
    this.info("");
    this.info("━".repeat(50));
    this.info("");
  }

  override showHelp(): void {
    console.log(`
${this.name} - ${this.description}

Usage:
  bun cli ${this.name} [options]

Options:
  --skip-imports     Skip static data imports (only setup database)
  --help             Show this help message

Description:
  This command sets up the entire EVE Kill system from scratch:

  1. Creates the database directory if needed
  2. Runs all database migrations
  3. Imports static game data:
     - Universe data (regions, constellations, systems)
     - Item data (categories, groups, types)

  After running this command, you can start importing killmails
  with 'bun cli redisq' and run the web server with 'bun index.ts'.

Examples:
  bun cli ${this.name}                # Full bootstrap
  bun cli ${this.name} --skip-imports # Only database setup
`);
  }
}
