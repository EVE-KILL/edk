import { BaseCommand } from "../../../src/commands/base-command";
import { db } from "../../../src/db";
import { types } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../../src/utils/logger";

const EVEREF_BASE = "https://ref-data.everef.net";
const BATCH_SIZE = 100;  // Increased batch size since everef is on Cloudflare

interface EveRefType {
  type_id: number;
  name: Record<string, string>;
  description?: Record<string, string>;
  group_id: number;
  category_id: number;
  market_group_id?: number;
  published: boolean;
  volume?: number;
  mass?: number;
  capacity?: number;
  portion_size?: number;
  radius?: number;
  icon_id?: number;
  graphic_id?: number;
  // Keep other fields in raw data
  [key: string]: any;
}

async function fetchEveRefData<T>(path: string): Promise<T> {
  const url = `${EVEREF_BASE}${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

async function fetchAllTypeIds(): Promise<number[]> {
  logger.info("Fetching all type IDs from everef...");
  try {
    const data = await fetchEveRefData<number[]>("/types");
    return data;
  } catch (error) {
    logger.error(`Failed to fetch type IDs: ${error}`);
    throw error;
  }
}

async function fetchTypeData(typeId: number): Promise<EveRefType | null> {
  try {
    return await fetchEveRefData<EveRefType>(`/types/${typeId}`);
  } catch (error) {
    // Some types might not exist, that's ok
    return null;
  }
}

async function updateTypeInDatabase(eveRefData: EveRefType) {
  const typeId = eveRefData.type_id;
  const firstKey = Object.keys(eveRefData.name || {})[0] || "";
  const englishName = eveRefData.name?.en || eveRefData.name?.[firstKey] || `Type ${typeId}`;
  const englishDescription = eveRefData.description?.en || undefined;

  // Check if type exists
  const existing = await db
    .select({ typeId: types.typeId })
    .from(types)
    .where(eq(types.typeId, typeId))
    .limit(1);

  const updateData = {
    name: englishName,
    groupId: eveRefData.group_id,
    categoryId: eveRefData.category_id,
    description: englishDescription,
    published: eveRefData.published as any,
    marketGroupId: eveRefData.market_group_id,
    mass: eveRefData.mass?.toString(),
    volume: eveRefData.volume?.toString(),
    capacity: eveRefData.capacity?.toString(),
    portionSize: eveRefData.portion_size,
    radius: eveRefData.radius?.toString(),
    iconId: eveRefData.icon_id,
    graphicId: eveRefData.graphic_id,
    rawData: eveRefData as any,
  };

  if (existing.length === 0) {
    // Insert new record
    await db.insert(types).values({
      typeId: typeId as any,
      ...updateData,
    } as any);
  } else {
    // Update existing record
    await db
      .update(types)
      .set(updateData as any)
      .where(eq(types.typeId, typeId));
  }
}

export default class FetchEveRefDataCommand extends BaseCommand {
  override name = "esi:fetch-everef-data";
  override description = "Fetch type data from everef and populate database";
  override usage = "esi:fetch-everef-data [options]";
  override examples = [
    "bun cli esi:fetch-everef-data           # Fetch and update all types",
  ];

  async execute(_args: string[]): Promise<void> {
    this.info("Starting everef data fetch...");

    try {
      // Fetch all available type IDs from everef
      const allTypeIds = await fetchAllTypeIds();

      this.info(`Found ${allTypeIds.length} types in everef`);
      this.info(`Fetching and updating all types in database`);

      // Fetch and update in batches
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < allTypeIds.length; i += BATCH_SIZE) {
        const batch = allTypeIds.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allTypeIds.length / BATCH_SIZE);

        this.info(`Processing batch ${batchNum}/${totalBatches} (types ${i + 1}-${Math.min(i + BATCH_SIZE, allTypeIds.length)})`);

        const typeDataPromises = batch.map(id => fetchTypeData(id));
        const typeDataList = await Promise.all(typeDataPromises);

        for (let j = 0; j < batch.length; j++) {
          const typeData = typeDataList[j];

          if (typeData) {
            try {
              await updateTypeInDatabase(typeData);
              successCount++;
            } catch (error) {
              this.error(`Failed to update type ${typeData.type_id}: ${error}`);
              errorCount++;
            }
          }
        }

        // Log progress periodically
        if (batchNum % 10 === 0) {
          this.info(`Progress: ${successCount} types added/updated, ${errorCount} errors`);
        }

        // No delay needed - everef is on Cloudflare and can handle it
      }

      this.success(`everef data fetch completed! Updated ${successCount} types, ${errorCount} errors`);
    } catch (error) {
      this.error(`Fatal error during everef data fetch: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
}
