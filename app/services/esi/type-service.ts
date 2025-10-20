import { db } from "../../../src/db";
import { types } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { BaseESIService } from "../../../src/services/esi/base-service";

interface ESIType {
  capacity?: number;
  description: string;
  graphic_id?: number;
  group_id: number;
  icon_id?: number;
  market_group_id?: number;
  mass?: number;
  name: string;
  packaged_volume?: number;
  portion_size?: number;
  published: boolean;
  radius?: number;
  type_id: number;
  volume?: number;
}

interface TypeData {
  typeId: number;
  name: string;
  description: string | null;
  groupId: number;
  categoryId?: number | null;
  published: boolean;
  marketGroupId?: number | null;
  mass: string | null;
  volume: string | null;
  capacity: string | null;
  portionSize?: number | null;
  radius: string | null;
  iconId?: number | null;
  graphicId?: number | null;
  rawData: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export class TypeService extends BaseESIService {
  async getType(typeId: number): Promise<TypeData | null> {
    // Check database first
    const existing = await db
      .select()
      .from(types)
      .where(eq(types.typeId, typeId))
      .get();

    if (existing) {
      return existing;
    }

    // Fetch from ESI
    return this.refreshType(typeId);
  }

  async refreshType(typeId: number): Promise<TypeData | null> {
    const path = `/universe/types/${typeId}/`;
    const cacheKey = `type-${typeId}`;
    const data = await this.fetchFromESI<ESIType>(path, cacheKey);

    if (!data) {
      return null;
    }

    const transformedData = this.transformESIData(data);

    // Upsert to database
    await db
      .insert(types)
      .values(transformedData)
      .onConflictDoUpdate({
        target: types.typeId,
        set: {
          name: transformedData.name,
          description: transformedData.description,
          groupId: transformedData.groupId,
          categoryId: transformedData.categoryId,
          published: transformedData.published,
          marketGroupId: transformedData.marketGroupId,
          mass: transformedData.mass,
          volume: transformedData.volume,
          capacity: transformedData.capacity,
          portionSize: transformedData.portionSize,
          radius: transformedData.radius,
          iconId: transformedData.iconId,
          graphicId: transformedData.graphicId,
          rawData: transformedData.rawData,
          updatedAt: new Date(),
        },
      });

    return transformedData;
  }

  private transformESIData(data: ESIType): TypeData {
    return {
      typeId: data.type_id,
      name: data.name,
      description: data.description || null,
      groupId: data.group_id,
      categoryId: null, // ESI doesn't provide this directly
      published: data.published,
      marketGroupId: data.market_group_id ?? null,
      mass: data.mass?.toString() ?? null,
      volume: data.volume?.toString() ?? null,
      capacity: data.capacity?.toString() ?? null,
      portionSize: data.portion_size ?? null,
      radius: data.radius?.toString() ?? null,
      iconId: data.icon_id ?? null,
      graphicId: data.graphic_id ?? null,
      rawData: data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
