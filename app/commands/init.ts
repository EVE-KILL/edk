import { BaseCommand } from "../../src/commands/base-command";
import { logger } from "../../src/utils/logger";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const SDE_URL = "https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip";
const SDE_DIR = join(process.cwd(), "data", "sde");
const SDE_ZIP = join(SDE_DIR, "sde-latest.zip");

export default class InitCommand extends BaseCommand {
  override name = "init";
  override description = "Initialize EVE-Kill with static data from SDE and external APIs";
  override usage = "init [--skip-download] [--skip-sde] [--skip-esi] [--skip-everef]";
  override examples = [
    "bun cli init                     # Full initialization",
    "bun cli init --skip-download     # Skip downloading SDE (use existing)",
    "bun cli init --skip-sde          # Skip SDE import",
    "bun cli init --skip-esi          # Skip ESI data fetch",
    "bun cli init --skip-everef       # Skip EverRef data fetch",
  ];

  async execute(args: string[]): Promise<void> {
    const skipDownload = args.includes("--skip-download");
    const skipSDE = args.includes("--skip-sde");
    const skipESI = args.includes("--skip-esi");
    const skipEverRef = args.includes("--skip-everef");

    this.info("=".repeat(60));
    this.info("EVE-Kill Initialization");
    this.info("=".repeat(60));

    // Step 1: Download SDE
    if (!skipDownload && !skipSDE) {
      await this.downloadSDE();
    } else if (skipDownload) {
      this.info("⏭️  Skipping SDE download (using existing files)");
    }

    // Step 2: Import SDE data
    if (!skipSDE) {
      await this.importSDE();
    } else {
      this.info("⏭️  Skipping SDE import");
    }

    // Step 3: Fetch EverRef data (types with category_id)
    if (!skipEverRef) {
      await this.fetchEverRefData();
    } else {
      this.info("⏭️  Skipping EverRef data fetch");
    }

    // Step 4: Fetch ESI data (characters, corporations, alliances for existing killmails)
    if (!skipESI) {
      await this.fetchESIData();
    } else {
      this.info("⏭️  Skipping ESI data fetch");
    }

    this.success("=".repeat(60));
    this.success("✅ Initialization complete!");
    this.success("=".repeat(60));
  }

  private async downloadSDE(): Promise<void> {
    this.info("\n📥 Step 1: Downloading SDE");
    this.info("-".repeat(60));

    // Create SDE directory if it doesn't exist
    if (!existsSync(SDE_DIR)) {
      mkdirSync(SDE_DIR, { recursive: true });
    }

    // Check if SDE already exists
    if (existsSync(SDE_ZIP)) {
      this.warn("SDE zip already exists. Delete it to re-download.");
      return;
    }

    this.info(`Downloading from: ${SDE_URL}`);
    this.info(`Saving to: ${SDE_ZIP}`);

    // Use Bun's native fetch and file writing
    const response = await fetch(SDE_URL);
    if (!response.ok) {
      throw new Error(`Failed to download SDE: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await Bun.write(SDE_ZIP, arrayBuffer);

    this.success(`✅ Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // Unzip the file
    this.info("Extracting SDE...");
    const proc = Bun.spawn(["unzip", "-q", "-o", "sde-latest.zip"], {
      cwd: SDE_DIR,
      stdout: "inherit",
      stderr: "inherit",
    });

    await proc.exited;

    this.success("✅ SDE extracted successfully");
  }

  private async importSDE(): Promise<void> {
    this.info("\n📊 Step 2: Importing SDE Data");
    this.info("-".repeat(60));

    const tasks = [
      { name: "Regions", command: "init:import-regions" },
      { name: "Constellations", command: "init:import-constellations" },
      { name: "Solar Systems", command: "init:import-systems" },
      { name: "Categories", command: "init:import-categories" },
      { name: "Groups", command: "init:import-groups" },
      { name: "Types", command: "init:import-types" },
    ];

    for (const task of tasks) {
      this.info(`\nImporting ${task.name}...`);
      const proc = Bun.spawn(["bun", "cli", task.command], {
        stdout: "inherit",
        stderr: "inherit",
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) {
        throw new Error(`Failed to import ${task.name} (exit code: ${exitCode})`);
      }
    }

    this.success("✅ SDE data imported successfully");
  }

  private async fetchEverRefData(): Promise<void> {
    this.info("\n🌐 Step 3: Fetching EverRef Data");
    this.info("-".repeat(60));

    this.info("Fetching type data from EverRef (includes category_id)...");
    const proc = Bun.spawn(["bun", "cli", "esi:fetch-everef-data"], {
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to fetch EverRef data (exit code: ${exitCode})`);
    }

    this.success("✅ EverRef data fetched successfully");
  }

  private async fetchESIData(): Promise<void> {
    this.info("\n🔄 Step 4: Fetching ESI Data");
    this.info("-".repeat(60));

    this.info("Note: ESI data (characters, corps, alliances) will be fetched");
    this.info("automatically as killmails are processed. No action needed here.");
    this.success("✅ ESI setup complete");
  }
}
