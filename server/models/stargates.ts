import { database } from '../helpers/database';

/**
 * Stargates Model
 *
 * Provides query methods for stargates SDE table
 */

export interface Stargate {
  stargateId: number;
  name: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  solarSystemId: number;
  destinationGateId: number;
  destinationSolarSystemId: number;
  typeId: number;
}

/**
 * Get a single stargate by ID
 */
export async function getStargate(
  stargateId: number
): Promise<Stargate | null> {
  const [row] = await database.sql<Stargate[]>`
    SELECT * FROM stargates WHERE "stargateId" = ${stargateId}
  `;
  return row || null;
}

/**
 * Get all stargates in a solar system
 */
export async function getStargatesBySystem(
  solarSystemId: number
): Promise<Stargate[]> {
  return await database.sql<Stargate[]>`
    SELECT * FROM stargates WHERE "solarSystemId" = ${solarSystemId} ORDER BY name
  `;
}

/**
 * Get stargate destination
 */
export async function getStargateDestination(
  stargateId: number
): Promise<{ gateId: number; systemId: number } | null> {
  const [result] = await database.sql<any[]>`
    SELECT "destinationGateId", "destinationSolarSystemId" FROM stargates WHERE "stargateId" = ${stargateId}
  `;
  return result
    ? {
        gateId: result.destinationGateId,
        systemId: result.destinationSolarSystemId,
      }
    : null;
}

/**
 * Search stargates by name
 */
export async function searchStargates(
  namePattern: string,
  limit: number = 10
): Promise<Stargate[]> {
  return await database.sql<Stargate[]>`
    SELECT * FROM stargates
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `;
}

/**
 * Get stargate name by ID
 */
export async function getStargateName(
  stargateId: number
): Promise<string | null> {
  const [result] = await database.sql<{ name: string }[]>`
    SELECT name FROM stargates WHERE "stargateId" = ${stargateId}
  `;
  return result?.name || null;
}

/**
 * Count total stargates
 */
export async function countStargates(): Promise<number> {
  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM stargates
  `;
  return Number(result?.count || 0);
}
