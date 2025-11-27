import { database } from '../helpers/database';

/**
 * Solar Systems Model
 *
 * Provides query methods for solarSystems SDE table
 */

export interface SolarSystem {
  solarSystemId: number;
  border: number;
  constellationId: number;
  corridor: number;
  factionId?: number;
  fringe: number;
  hub: number;
  international: number;
  luminosity: number;
  name: string;
  planetIds: number[];
  positionX: number;
  positionY: number;
  positionZ: number;
  radius: number;
  regional: number;
  regionId: number;
  securityClass: string;
  securityStatus: number;
  stargateIds: number[];
  starId: number;
  visualEffect: string;
  wormholeClassId?: number;
  updatedAt: string;
}

/**
 * Get a single solar system by ID
 */
export async function getSolarSystem(
  solarSystemId: number
): Promise<SolarSystem | null> {
  return database.findOne<SolarSystem>(
    'SELECT * FROM solarsystems WHERE "solarSystemId" = :solarSystemId',
    { solarSystemId }
  );
}

/**
 * Get all solar systems in a region
 */
export async function getSolarSystemsByRegion(
  regionId: number
): Promise<SolarSystem[]> {
  return database.find<SolarSystem>(
    'SELECT * FROM solarsystems WHERE "regionId" = :regionId ORDER BY name',
    { regionId }
  );
}

/**
 * Get all solar systems in a constellation
 */
export async function getSolarSystemsByConstellation(
  constellationId: number
): Promise<SolarSystem[]> {
  return database.find<SolarSystem>(
    'SELECT * FROM solarsystems WHERE "constellationId" = :constellationId ORDER BY name',
    { constellationId }
  );
}

/**
 * Search solar systems by name
 */
export async function searchSolarSystems(
  namePattern: string,
  limit: number = 10
): Promise<SolarSystem[]> {
  return database.find<SolarSystem>(
    `SELECT * FROM solarsystems
       WHERE "name" ILIKE :pattern
       ORDER BY "name"
       LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get solar system name by ID
 */
export async function getSolarSystemName(
  solarSystemId: number
): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT "name" FROM solarsystems WHERE "solarSystemId" = :solarSystemId',
    { solarSystemId }
  );
  return result?.name || null;
}

/**
 * Get high/low/null security systems in a region
 */
export async function getSecurityClassSystems(
  regionId: number,
  securityClass: 'A' | 'B' | 'C'
): Promise<SolarSystem[]> {
  return database.find<SolarSystem>(
    `SELECT * FROM solarsystems
       WHERE "regionId" = :regionId AND "securityClass" = :securityClass
       ORDER BY "securityStatus" DESC`,
    { regionId, securityClass }
  );
}

/**
 * Get trade hubs
 */
export async function getTradeHubs(): Promise<SolarSystem[]> {
  return database.find<SolarSystem>(
    'SELECT * FROM solarsystems WHERE hub = 1 ORDER BY "regionId", name'
  );
}

/**
 * Get hub systems
 */
export async function getHubSystems(): Promise<SolarSystem[]> {
  return database.find<SolarSystem>(
    'SELECT * FROM solarsystems WHERE hub = 1 ORDER BY "regionId", name'
  );
}

/**
 * Count total solar systems
 */
export async function countSolarSystems(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM solarsystems'
  );
  return Number(result?.count || 0);
}

/**
 * Get stats for a solar system
 */
export async function getSystemStats(solarSystemId: number): Promise<any> {
  const result = await database.findOne<{
    kills: number;
    iskDestroyed: number;
  }>(
    `SELECT
      count(*) as kills,
      sum("totalValue") as "iskDestroyed"
    FROM killmails
    WHERE "solarSystemId" = :solarSystemId`,
    { solarSystemId }
  );

  return {
    kills: Number(result?.kills ?? 0),
    losses: 0,
    iskDestroyed: Number(result?.iskDestroyed ?? 0),
    iskLost: 0,
    efficiency: 100,
    iskEfficiency: 100,
    killLossRatio: 0,
  };
}
