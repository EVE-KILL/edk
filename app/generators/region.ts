import { db } from "../../src/db";
import { regions } from "../../db/schema";
import { eq } from "drizzle-orm";

export interface RegionDetail {
  region: {
    id: number;
    name: string;
  };
}

/**
 * Generate region detail information
 */
export async function generateRegionDetail(regionId: number): Promise<RegionDetail | null> {
  try {
    // Fetch region data
    const region = await db.query.regions.findFirst({
      where: eq(regions.regionId, regionId),
    });

    if (!region) {
      return null;
    }

    return {
      region: {
        id: region.regionId,
        name: region.name,
      },
    };
  } catch (error) {
    console.error(`Failed to generate region detail for ${regionId}:`, error);
    return null;
  }
}
