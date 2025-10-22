import { db } from "../../src/db";
import { solarSystems, regions } from "../../db/schema";
import { eq } from "drizzle-orm";

export interface SystemDetail {
  system: {
    id: number;
    name: string;
    securityClass: string;
    securityStatus: number;
  };
  region: {
    id: number;
    name: string;
  };
}

/**
 * Generate system detail information
 */
export async function generateSystemDetail(systemId: number): Promise<SystemDetail | null> {
  try {
    // Fetch system data
    const system = await db.query.solarSystems.findFirst({
      where: eq(solarSystems.systemId, systemId),
    });

    if (!system) {
      return null;
    }

    // Fetch region data
    let regionName = "Unknown";
    let regionId = 0;
    if (system.regionId) {
      const region = await db.query.regions.findFirst({
        where: eq(regions.regionId, system.regionId),
      });
      if (region) {
        regionName = region.name;
        regionId = region.regionId;
      }
    }

    return {
      system: {
        id: system.systemId,
        name: system.name,
        securityClass: system.securityClass || "Unknown",
        securityStatus: parseFloat(system.securityStatus || "0") || 0,
      },
      region: {
        id: regionId,
        name: regionName,
      },
    };
  } catch (error) {
    console.error(`Failed to generate system detail for ${systemId}:`, error);
    return null;
  }
}
