import { BaseCommand } from "../../../src/commands/base-command";
import { db } from "../../../src/db";
import { solarSystems } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const SDE_DIR = join(process.cwd(), "data", "sde");
const SYSTEMS_FILE = join(SDE_DIR, "mapSolarSystems.jsonl");

interface SDESolarSystem {
  _key: number;
  name: Record<string, string>;
  constellationID: number;
  regionID: number;
  securityStatus: number;
  securityClass?: string;
  starID?: number;
  position?: { x: number; y: number; z: number };
  border?: boolean;
  hub?: boolean;
  international?: boolean;
  regional?: boolean;
  [key: string]: any;
}

export default class ImportSystemsCommand extends BaseCommand {
  override name = "init:import-systems";
  override description = "Import solar systems from SDE mapSolarSystems.jsonl";
  override usage = "init:import-systems";

  async execute(_args: string[]): Promise<void> {
    if (!existsSync(SYSTEMS_FILE)) {
      this.error(`SDE file not found: ${SYSTEMS_FILE}`);
      this.error("Run 'bun cli init' first to download the SDE");
      process.exit(1);
    }

    this.info(`Reading solar systems from ${SYSTEMS_FILE}...`);

    const fileContent = readFileSync(SYSTEMS_FILE, "utf-8");
    const lines = fileContent.trim().split("\n");

    this.info(`Found ${lines.length} solar systems to import`);

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (const line of lines) {
      try {
        const sdeSystem: SDESolarSystem = JSON.parse(line);
        const systemId = sdeSystem._key;
        const englishName = sdeSystem.name?.en || `System ${systemId}`;

        // Check if exists
        const existing = await db
          .select({ systemId: solarSystems.systemId })
          .from(solarSystems)
          .where(eq(solarSystems.systemId, systemId))
          .limit(1);

        const systemData = {
          name: englishName,
          constellationId: sdeSystem.constellationID,
          regionId: sdeSystem.regionID,
          securityStatus: sdeSystem.securityStatus.toString(),
          securityClass: sdeSystem.securityClass,
          starId: sdeSystem.starID,
          positionX: sdeSystem.position?.x?.toString(),
          positionY: sdeSystem.position?.y?.toString(),
          positionZ: sdeSystem.position?.z?.toString(),
          rawData: sdeSystem as any,
        };

        if (existing.length === 0) {
          await db.insert(solarSystems).values({
            systemId: systemId as any,
            ...systemData,
          } as any);
          imported++;
        } else {
          await db
            .update(solarSystems)
            .set(systemData as any)
            .where(eq(solarSystems.systemId, systemId));
          updated++;
        }

        if ((imported + updated) % 100 === 0) {
          this.info(`Progress: ${imported + updated}/${lines.length}`);
        }
      } catch (error) {
        this.error(`Failed to import system: ${error}`);
        errors++;
      }
    }

    this.success(`✅ Imported ${imported} new systems, updated ${updated}, ${errors} errors`);
  }
}
