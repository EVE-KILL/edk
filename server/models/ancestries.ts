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
  const [row] = await database.sql<Ancestry[]>`
    SELECT * FROM ancestries WHERE ancestryId = ${ancestryId}
  `;
  return row || null;
}

/**
 * Get all ancestries for a bloodline
 */
export async function getAncestriesByBloodline(
  bloodlineId: number
): Promise<Ancestry[]> {
  return await database.sql<Ancestry[]>`
    SELECT * FROM ancestries WHERE bloodlineId = ${bloodlineId} ORDER BY name
  `;
}

/**
 * Get all ancestries
 */
export async function getAllAncestries(): Promise<Ancestry[]> {
  return await database.sql<Ancestry[]>`
    SELECT * FROM ancestries ORDER BY bloodlineId, name
  `;
}

/**
 * Search ancestries by name
 */
export async function searchAncestries(
  namePattern: string,
  limit: number = 10
): Promise<Ancestry[]> {
  return await database.sql<Ancestry[]>`
    SELECT * FROM ancestries
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `;
}
