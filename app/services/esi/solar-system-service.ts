import { db } from "../../../src/db";
import { solarSystems } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { BaseESIService } from "../../../src/services/esi/base-service";

interface ESISolarSystem {
  constellation_id: number;
  name: string;
  planets?: Array<{
    asteroid_belts?: number[];
    moons?: number[];
    planet_id: number;
  }>;
  position: {
    x: number;
    y: number;
    z: number;
  };
  security_class?: string;
  security_status: number;
  star_id?: number;
  stargates?: number[];
  stations?: number[];
  system_id: number;
}

interface SolarSystemData {
  systemId: number;
  name: string;
  constellationId: number;
  securityStatus: string;
  starId?: number | null;
  positionX: string | null;
  positionY: string | null;
  positionZ: string | null;
  securityClass?: string | null;
  rawData: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export class SolarSystemService extends BaseESIService {
  async getSolarSystem(systemId: number): Promise<SolarSystemData | null> {
    // Check database first
    const existing = await db
      .select()
      .from(solarSystems)
      .where(eq(solarSystems.systemId, systemId))
      .get();

    if (existing) {
      return existing;
    }

    // Fetch from ESI
    return this.refreshSolarSystem(systemId);
  }

  async refreshSolarSystem(systemId: number): Promise<SolarSystemData | null> {
    const path = `/universe/systems/${systemId}/`;
    const cacheKey = `solar-system-${systemId}`;
    const data = await this.fetchFromESI<ESISolarSystem>(path, cacheKey);

    if (!data) {
      return null;
    }

    const transformedData = this.transformESIData(data);

    // Upsert to database
    await db
      .insert(solarSystems)
      .values(transformedData)
      .onConflictDoUpdate({
        target: solarSystems.systemId,
        set: {
          name: transformedData.name,
          constellationId: transformedData.constellationId,
          securityStatus: transformedData.securityStatus,
          starId: transformedData.starId,
          positionX: transformedData.positionX,
          positionY: transformedData.positionY,
          positionZ: transformedData.positionZ,
          securityClass: transformedData.securityClass,
          rawData: transformedData.rawData,
          updatedAt: new Date(),
        },
      });

    return transformedData;
  }

  private transformESIData(data: ESISolarSystem): SolarSystemData {
    return {
      systemId: data.system_id,
      name: data.name,
      constellationId: data.constellation_id,
      securityStatus: data.security_status.toString(),
      starId: data.star_id ?? null,
      positionX: data.position.x.toString(),
      positionY: data.position.y.toString(),
      positionZ: data.position.z.toString(),
      securityClass: data.security_class ?? null,
      rawData: data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
