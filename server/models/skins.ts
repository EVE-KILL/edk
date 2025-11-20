import { database } from '../helpers/database'

/**
 * Skins Model
 *
 * Provides query methods for skins SDE table
 */

export interface Skin {
  skinId: number
  name: string
  description?: string
  iconId?: number
  internalName?: string
}

/**
 * Get a single skin by ID
 */
export async function getSkin(skinId: number): Promise<Skin | null> {
  return await database.queryOne<Skin>(
    'SELECT * FROM skins WHERE skinId = {id:UInt32}',
    { id: skinId }
  )
}

/**
 * Get all skins
 */
export async function getAllSkins(): Promise<Skin[]> {
  return await database.query<Skin>(
    'SELECT * FROM skins ORDER BY name'
  )
}

/**
 * Search skins by name
 */
export async function searchSkins(namePattern: string, limit: number = 10): Promise<Skin[]> {
  return await database.query<Skin>(
    'SELECT * FROM skins WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get skin name by ID
 */
export async function getSkinName(skinId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM skins WHERE skinId = {id:UInt32}',
    { id: skinId }
  )
  return result || null
}

/**
 * Search skins by internal name
 */
export async function searchSkinsByInternalName(internalName: string): Promise<Skin[]> {
  return await database.query<Skin>(
    'SELECT * FROM skins WHERE internalName LIKE {pattern:String}',
    { pattern: `%${internalName}%` }
  )
}

/**
 * Count total skins
 */
export async function countSkins(): Promise<number> {
  return await database.count('skins')
}
