import { database } from '../helpers/database';

/**
 * Stars Model
 *
 * Provides query methods for stars SDE table
 */

export interface Star {
  starId: number;
  age: number;
  luminosity: number;
  name: string;
  radius: number;
  solarSystemId: number;
  spectralClass: string;
  temperature: number;
  typeId: number;
}

/**
 * Get a single star by ID
 */
export async function getStar(starId: number): Promise<Star | null> {
  return database.findOne<Star>(
    'SELECT * FROM stars WHERE "starId" = :starId',
    { starId }
  );
}

/**
 * Get star in a solar system
 */
export async function getStarBySystem(
  solarSystemId: number
): Promise<Star | null> {
  return database.findOne<Star>(
    'SELECT * FROM stars WHERE "solarSystemId" = :solarSystemId',
    { solarSystemId }
  );
}

/**
 * Get all stars by spectral class
 */
export async function getStarsBySpectralClass(
  spectralClass: string
): Promise<Star[]> {
  return database.find<Star>(
    'SELECT * FROM stars WHERE "spectralClass" = :spectralClass ORDER BY temperature DESC',
    { spectralClass }
  );
}

/**
 * Search stars by name
 */
export async function searchStars(
  namePattern: string,
  limit: number = 10
): Promise<Star[]> {
  return database.find<Star>(
    `SELECT * FROM stars
     WHERE "name" ILIKE :pattern
     ORDER BY "name"
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get hottest stars
 */
export async function getHottestStars(limit: number = 10): Promise<Star[]> {
  return database.find<Star>(
    'SELECT * FROM stars ORDER BY temperature DESC LIMIT :limit',
    { limit }
  );
}

/**
 * Count total stars
 */
export async function countStars(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM stars'
  );
  return Number(result?.count || 0);
}
