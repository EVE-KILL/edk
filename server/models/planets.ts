import { database } from '../helpers/database';

/**
 * Planets Model
 *
 * Provides query methods for planets SDE table
 */

export interface Planet {
  planetId: number;
  celestialIndex: number;
  name: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  solarSystemId: number;
  typeId: number;
}

/**
 * Get a single planet by ID
 */
export async function getPlanet(planetId: number): Promise<Planet | null> {
  return database.findOne<Planet>(
    'SELECT * FROM planets WHERE "planetId" = :planetId',
    { planetId }
  );
}

/**
 * Get all planets in a solar system
 */
export async function getPlanetsBySystem(
  solarSystemId: number
): Promise<Planet[]> {
  return database.find<Planet>(
    'SELECT * FROM planets WHERE "solarSystemId" = :solarSystemId ORDER BY "celestialIndex"',
    { solarSystemId }
  );
}

/**
 * Search planets by name
 */
export async function searchPlanets(
  namePattern: string,
  limit: number = 10
): Promise<Planet[]> {
  return database.find<Planet>(
    `SELECT * FROM planets
     WHERE "name" ILIKE :pattern
     ORDER BY "name"
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get planet name by ID
 */
export async function getPlanetName(planetId: number): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT "name" FROM planets WHERE "planetId" = :planetId',
    { planetId }
  );
  return result?.name || null;
}

/**
 * Count total planets
 */
export async function countPlanets(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM planets'
  );
  return Number(result?.count || 0);
}
