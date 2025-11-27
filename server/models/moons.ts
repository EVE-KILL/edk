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
  return database.findOne<Moon>(
    'SELECT * FROM moons WHERE "moonId" = :moonId',
    { moonId }
  );
}

/**
 * Get all moons orbiting a planet
 */
export async function getMoonsByPlanet(planetId: number): Promise<Moon[]> {
  return database.find<Moon>(
    'SELECT * FROM moons WHERE "planetId" = :planetId ORDER BY "celestialIndex"',
    { planetId }
  );
}

/**
 * Get all moons in a solar system
 */
export async function getMoonsBySystem(solarSystemId: number): Promise<Moon[]> {
  return database.find<Moon>(
    'SELECT * FROM moons WHERE "solarSystemId" = :solarSystemId ORDER BY name',
    { solarSystemId }
  );
}

/**
 * Search moons by name
 */
export async function searchMoons(
  namePattern: string,
  limit: number = 10
): Promise<Moon[]> {
  return database.find<Moon>(
    `SELECT * FROM moons
     WHERE "name" ILIKE :pattern
     ORDER BY "name"
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get moon name by ID
 */
export async function getMoonName(moonId: number): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT "name" FROM moons WHERE "moonId" = :moonId',
    { moonId }
  );
  return result?.name || null;
}

/**
 * Count total moons
 */
export async function countMoons(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM moons'
  );
  return Number(result?.count || 0);
}
