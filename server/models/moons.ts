import { database } from '../helpers/database';

/**
 * Moons Model
 *
 * Provides query methods for moons SDE table
 */

export interface Moon {
  moonId: number;
  celestialIndex: number;
  name: string;
  planetId: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  solarSystemId: number;
  typeId: number;
}

/**
 * Get a single moon by ID
 */
export async function getMoon(moonId: number): Promise<Moon | null> {
  const [row] = await database.sql<Moon[]>`
    SELECT * FROM moons WHERE moonId = ${moonId}
  `;
  return row || null;
}

/**
 * Get all moons orbiting a planet
 */
export async function getMoonsByPlanet(planetId: number): Promise<Moon[]> {
  return await database.sql<Moon[]>`
    SELECT * FROM moons WHERE planetId = ${planetId} ORDER BY celestialIndex
  `;
}

/**
 * Get all moons in a solar system
 */
export async function getMoonsBySystem(solarSystemId: number): Promise<Moon[]> {
  return await database.sql<Moon[]>`
    SELECT * FROM moons WHERE solarSystemId = ${solarSystemId} ORDER BY name
  `;
}

/**
 * Search moons by name
 */
export async function searchMoons(
  namePattern: string,
  limit: number = 10
): Promise<Moon[]> {
  return await database.sql<Moon[]>`
    SELECT * FROM moons
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `;
}

/**
 * Get moon name by ID
 */
export async function getMoonName(moonId: number): Promise<string | null> {
  const [result] = await database.sql<{ name: string }[]>`
    SELECT name FROM moons WHERE moonId = ${moonId}
  `;
  return result?.name || null;
}

/**
 * Count total moons
 */
export async function countMoons(): Promise<number> {
  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM moons
  `;
  return Number(result?.count || 0);
}
