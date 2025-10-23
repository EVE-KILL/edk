import { BaseWorker } from "../../src/queue/base-worker";
import { db } from "../../src/db";
import { types } from "../../db/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../src/utils/logger";

interface TypeFetcherPayload {
  typeId: number;
}

const EVEREF_BASE = "https://ref-data.everef.net";

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
  [key: string]: any;
}

async function fetchEveRefType(typeId: number): Promise<EveRefType | null> {
  try {
    const url = `${EVEREF_BASE}/types/${typeId}`;
    const response = await fetch(url);
    if (!response.ok) {
      logger.error(`Failed to fetch type ${typeId} from everef: ${response.statusText}`);
      return null;
    }
    return response.json() as Promise<EveRefType>;
  } catch (error) {
    logger.error(`Failed to fetch type ${typeId}: ${error}`);
    return null;
  }
}

export class TypeFetcher extends BaseWorker {
  override queueName = "type-fetch";
  override concurrency = 5; // High concurrency - everef is on Cloudflare
  override pollInterval = 500; // Poll frequently for new jobs

  async handle(payload: TypeFetcherPayload, job: any): Promise<void> {
    const { typeId } = payload;

    logger.info(`Fetching type ${typeId} from everef`);

    try {
      // Check if type exists
      const existing = await db
        .select({ typeId: types.typeId, categoryId: types.categoryId })
        .from(types)
        .where(eq(types.typeId, typeId))
        .limit(1);

      // Only fetch if not in database AND has category_id
      if (existing.length > 0 && existing[0]?.categoryId !== null) {
        return;
      }

      const isUpdate = existing.length > 0;

      // Fetch from everef
      const eveRefData = await fetchEveRefType(typeId);
      if (!eveRefData) {
        logger.warn(`Could not fetch type ${typeId} from everef`);
        return;
      }

      // Store in database
      let englishName = `Type ${typeId}`;
      const nameObj = eveRefData.name as any;
      if (nameObj?.en) {
        englishName = nameObj.en;
      } else if (nameObj) {
        const nameKeys = Object.keys(nameObj);
        if (nameKeys.length > 0) {
          englishName = nameObj[(nameKeys[0] as any)];
        }
      }

      const descObj = eveRefData.description as any;
      const englishDescription = descObj?.en || undefined;

      const typeData = {
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

      if (isUpdate) {
        // Update existing type with everef data
        await db.update(types)
          .set(typeData as any)
          .where(eq(types.typeId, typeId));
        logger.info(`Updated type ${typeId} (${englishName}) with category ${eveRefData.category_id}`);
      } else {
        // Insert new type - use onConflictDoUpdate in case of race condition
        try {
          await db.insert(types).values({
            typeId: typeId as any,
            ...typeData,
          } as any);
          logger.info(`Inserted type ${typeId} (${englishName}) with category ${eveRefData.category_id}`);
        } catch (insertError: any) {
          // If unique constraint failed, try updating instead (race condition)
          if (insertError?.message?.includes('UNIQUE constraint failed')) {
            await db.update(types)
              .set(typeData as any)
              .where(eq(types.typeId, typeId));
            logger.info(`Updated type ${typeId} (${englishName}) with category ${eveRefData.category_id} (after insert conflict)`);
          } else {
            throw insertError;
          }
        }
      }
    } catch (error) {
      logger.error(`Error processing type fetch for ${typeId}: ${error}`);
      throw error;
    }
  }
}
