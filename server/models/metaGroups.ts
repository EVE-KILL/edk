import { database } from '../helpers/database';

/**
 * Meta Groups Model
 *
 * Provides query methods for metaGroups SDE table
 */

export interface MetaGroup {
  metaGroupId: number;
  name: string;
  description?: string;
  iconId?: number;
}

/**
 * Get a single meta group by ID
 */
export async function getMetaGroup(
  metaGroupId: number
): Promise<MetaGroup | null> {
  return database.findOne<MetaGroup>(
    'SELECT * FROM "metaGroups" WHERE "metaGroupId" = :metaGroupId',
    { metaGroupId }
  );
}

/**
 * Get all meta groups
 */
export async function getAllMetaGroups(): Promise<MetaGroup[]> {
  return database.find<MetaGroup>('SELECT * FROM "metaGroups" ORDER BY name');
}

/**
 * Search meta groups by name
 */
export async function searchMetaGroups(
  namePattern: string,
  limit: number = 10
): Promise<MetaGroup[]> {
  return database.find<MetaGroup>(
    `SELECT * FROM "metaGroups"
     WHERE name ILIKE :pattern
     ORDER BY name
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get meta group name by ID
 */
export async function getMetaGroupName(
  metaGroupId: number
): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT name FROM "metaGroups" WHERE "metaGroupId" = :metaGroupId',
    { metaGroupId }
  );
  return result?.name || null;
}

/**
 * Count total meta groups
 */
export async function countMetaGroups(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM "metaGroups"'
  );
  return Number(result?.count || 0);
}
