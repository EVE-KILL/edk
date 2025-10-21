import { BaseCommand } from "../../../src/commands/base-command";
import { db } from "../../../src/db";
import { regions } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { logger } from "../../../src/utils/logger";

const SDE_DIR = join(process.cwd(), "data", "sde");
const REGIONS_FILE = join(SDE_DIR, "mapRegions.jsonl");

interface SDERegion {
  _key: number;
  name: Record<string, string>;
  description?: Record<string, string>;
  position?: { x: number; y: number; z: number };
  nebulaID?: number;
  constellationIDs?: number[];
  factionID?: number;
  wormholeClassID?: number;
}

export default class ImportRegionsCommand extends BaseCommand {
  override name = "init:import-regions";
  override description = "Import regions from SDE mapRegions.jsonl";
  override usage = "init:import-regions";

  async execute(_args: string[]): Promise<void> {
    if (!existsSync(REGIONS_FILE)) {
      this.error(`SDE file not found: ${REGIONS_FILE}`);
      this.error("Run 'bun cli init' first to download the SDE");
      process.exit(1);
    }

    this.info(`Reading regions from ${REGIONS_FILE}...`);

    const fileContent = readFileSync(REGIONS_FILE, "utf-8");
    const lines = fileContent.trim().split("\n");

    this.info(`Found ${lines.length} regions to import`);

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const line of lines) {
      try {
        const sdeRegion: SDERegion = JSON.parse(line);
        const regionId = sdeRegion._key;
        const englishName = sdeRegion.name?.en || `Region ${regionId}`;
        const englishDescription = sdeRegion.description?.en;

        // Check if exists
        const existing = await db
          .select({ regionId: regions.regionId })
          .from(regions)
          .where(eq(regions.regionId, regionId))
          .limit(1);

        const regionData = {
          name: englishName,
          description: englishDescription,
          centerX: sdeRegion.position?.x?.toString(),
          centerY: sdeRegion.position?.y?.toString(),
          centerZ: sdeRegion.position?.z?.toString(),
          nebulaId: sdeRegion.nebulaID,
          rawData: sdeRegion as any,
        };

        if (existing.length === 0) {
          await db.insert(regions).values({
            regionId: regionId as any,
            ...regionData,
          } as any);
          imported++;
        } else {
          await db
            .update(regions)
            .set(regionData as any)
            .where(eq(regions.regionId, regionId));
          updated++;
        }

        if ((imported + updated) % 20 === 0) {
          this.info(`Progress: ${imported + updated}/${lines.length}`);
        }
      } catch (error) {
        this.error(`Failed to import region: ${error}`);
        errors++;
      }
    }

    this.success(`✅ Imported ${imported} new regions, updated ${updated}, ${errors} errors`);
  }
}
