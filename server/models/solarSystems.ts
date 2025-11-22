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
  const [row] = await database.sql<SolarSystem[]>`
    SELECT * FROM solarSystems WHERE "solarSystemId" = ${solarSystemId}
  `;
  return row || null;
}

/**
 * Get all solar systems in a region
 */
export async function getSolarSystemsByRegion(
  regionId: number
): Promise<SolarSystem[]> {
  return await database.sql<SolarSystem[]>`
    SELECT * FROM solarSystems WHERE "regionId" = ${regionId} ORDER BY name
  `;
}

/**
 * Get all solar systems in a constellation
 */
export async function getSolarSystemsByConstellation(
  constellationId: number
): Promise<SolarSystem[]> {
  return await database.sql<SolarSystem[]>`
    SELECT * FROM solarSystems WHERE "constellationId" = ${constellationId} ORDER BY name
  `;
}

/**
 * Search solar systems by name
 */
export async function searchSolarSystems(
  namePattern: string,
  limit: number = 10
): Promise<SolarSystem[]> {
  return await database.sql<SolarSystem[]>`
    SELECT * FROM solarSystems
     WHERE name ILIKE ${`%${namePattern}%`}
     ORDER BY name
     LIMIT ${limit}
  `;
}

/**
 * Get solar system name by ID
 */
export async function getSolarSystemName(
  solarSystemId: number
): Promise<string | null> {
  const [result] = await database.sql<{ name: string }[]>`
    SELECT name FROM solarSystems WHERE "solarSystemId" = ${solarSystemId}
  `;
  return result?.name || null;
}

/**
 * Get high/low/null security systems in a region
 */
export async function getSecurityClassSystems(
  regionId: number,
  securityClass: 'A' | 'B' | 'C'
): Promise<SolarSystem[]> {
  return await database.sql<SolarSystem[]>`
    SELECT * FROM solarSystems
     WHERE "regionId" = ${regionId} AND "securityClass" = ${securityClass}
     ORDER BY "securityStatus" DESC
  `;
}

/**
 * Get trade hubs
 */
export async function getTradeHubs(): Promise<SolarSystem[]> {
  return await database.sql<SolarSystem[]>`
    SELECT * FROM solarSystems WHERE hub = 1 ORDER BY "regionId", name
  `;
}

/**
 * Get hub systems
 */
export async function getHubSystems(): Promise<SolarSystem[]> {
  return await database.sql<SolarSystem[]>`
    SELECT * FROM solarSystems WHERE hub = 1 ORDER BY "regionId", name
  `;
}

/**
 * Count total solar systems
 */
export async function countSolarSystems(): Promise<number> {
  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM solarSystems
  `;
  return Number(result?.count || 0);
}

/**
 * Get stats for a solar system
 */
export async function getSystemStats(solarSystemId: number): Promise<any> {
  const [result] = await database.sql<any[]>`
    SELECT
      count(*) as kills,
      sum("totalValue") as iskDestroyed
    FROM killmails
    WHERE "solarSystemId" = ${solarSystemId}
  `;

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
