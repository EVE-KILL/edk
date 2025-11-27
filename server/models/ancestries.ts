import { database } from '../helpers/database';

/**
 * Ancestries Model
 *
 * Provides query methods for ancestries SDE table
 */

export interface Ancestry {
  ancestryId: number;
  name: string;
  bloodlineId: number;
  description?: string;
  iconId?: number;
  shortDescription?: string;
}

/**
 * Get a single ancestry by ID
 */
export async function getAncestry(
  ancestryId: number
): Promise<Ancestry | null> {
  return database.findOne<Ancestry>(
    'SELECT * FROM ancestries WHERE "ancestryId" = :ancestryId',
    { ancestryId }
  );
}

/**
 * Get all ancestries for a bloodline
 */
export async function getAncestriesByBloodline(
  bloodlineId: number
): Promise<Ancestry[]> {
  return database.find<Ancestry>(
    'SELECT * FROM ancestries WHERE "bloodlineId" = :bloodlineId ORDER BY name',
    { bloodlineId }
  );
}

/**
 * Get all ancestries
 */
export async function getAllAncestries(): Promise<Ancestry[]> {
  return database.find<Ancestry>(
    'SELECT * FROM ancestries ORDER BY "bloodlineId", name'
  );
}

/**
 * Search ancestries by name
 */
export async function searchAncestries(
  namePattern: string,
  limit: number = 10
): Promise<Ancestry[]> {
  return database.find<Ancestry>(
    `SELECT * FROM ancestries
     WHERE "name" ILIKE :pattern
     ORDER BY "name"
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}
