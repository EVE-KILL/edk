import { database } from '../helpers/database'

/**
 * Meta Groups Model
 *
 * Provides query methods for metaGroups SDE table
 */

export interface MetaGroup {
  metaGroupId: number
  name: string
  description?: string
  iconId?: number
}

/**
 * Get a single meta group by ID
 */
export async function getMetaGroup(metaGroupId: number): Promise<MetaGroup | null> {
  return await database.queryOne<MetaGroup>(
    'SELECT * FROM metaGroups FINAL WHERE metaGroupId = {id:UInt32}',
    { id: metaGroupId }
  )
}

/**
 * Get all meta groups
 */
export async function getAllMetaGroups(): Promise<MetaGroup[]> {
  return await database.query<MetaGroup>(
    'SELECT * FROM metaGroups FINAL ORDER BY name'
  )
}

/**
 * Search meta groups by name
 */
export async function searchMetaGroups(namePattern: string, limit: number = 10): Promise<MetaGroup[]> {
  return await database.query<MetaGroup>(
    'SELECT * FROM metaGroups FINAL WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get meta group name by ID
 */
export async function getMetaGroupName(metaGroupId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM metaGroups FINAL WHERE metaGroupId = {id:UInt32}',
    { id: metaGroupId }
  )
  return result || null
}

/**
 * Count total meta groups
 */
export async function countMetaGroups(): Promise<number> {
  return await database.count('metaGroups')
}
