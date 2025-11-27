import { database } from '../helpers/database';

/**
 * Skins Model
 *
 * Provides query methods for skins SDE table
 */

export interface Skin {
  skinId: number;
  name: string;
  description?: string;
  iconId?: number;
  internalName?: string;
}

/**
 * Get a single skin by ID
 */
export async function getSkin(skinId: number): Promise<Skin | null> {
  return database.findOne<Skin>(
    'SELECT * FROM skins WHERE "skinId" = :skinId',
    { skinId }
  );
}

/**
 * Get all skins
 */
export async function getAllSkins(): Promise<Skin[]> {
  return database.find<Skin>('SELECT * FROM skins ORDER BY name');
}

/**
 * Search skins by name
 */
export async function searchSkins(
  namePattern: string,
  limit: number = 10
): Promise<Skin[]> {
  return database.find<Skin>(
    `SELECT * FROM skins
     WHERE "name" ILIKE :pattern
     ORDER BY "name"
     LIMIT :limit`,
    { pattern: `%${namePattern}%`, limit }
  );
}

/**
 * Get skin name by ID
 */
export async function getSkinName(skinId: number): Promise<string | null> {
  const result = await database.findOne<{ name: string }>(
    'SELECT "name" FROM skins WHERE "skinId" = :skinId',
    { skinId }
  );
  return result?.name || null;
}

/**
 * Search skins by internal name
 */
export async function searchSkinsByInternalName(
  internalName: string
): Promise<Skin[]> {
  return database.find<Skin>(
    'SELECT * FROM skins WHERE "internalName" ILIKE :pattern',
    { pattern: `%${internalName}%` }
  );
}

/**
 * Count total skins
 */
export async function countSkins(): Promise<number> {
  const result = await database.findOne<{ count: number }>(
    'SELECT count(*) as count FROM skins'
  );
  return Number(result?.count || 0);
}
