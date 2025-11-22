import { database } from '../helpers/database';

/**
 * Races Model
 *
 * Provides query methods for races SDE table
 */

export interface Race {
  raceId: number;
  name: string;
  description?: string;
  iconId?: number;
}

/**
 * Get a single race by ID
 */
export async function getRace(raceId: number): Promise<Race | null> {
  return database.findOne<Race>(
    'SELECT * FROM races WHERE "raceId" = :raceId',
    { raceId }
  );
}

/**
 * Get all races
 */
export async function getAllRaces(): Promise<Race[]> {
  return database.find<Race>('SELECT * FROM races ORDER BY name');
}

/**
 * Search races by name
 */
export async function searchRaces(
  namePattern: string,
  limit: number = 10
): Promise<Race[]> {
  return database.find<Race>(
    `SELECT * FROM races
     WHERE name ILIKE :pattern
     ORDER BY name
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get race name by ID
 */
export async function getRaceName(raceId: number): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT name FROM races WHERE "raceId" = :raceId',
    { raceId }
  );
  return result?.name || null;
}

/**
 * Count total races
 */
export async function countRaces(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM races'
  );
  return Number(result?.count || 0);
}
