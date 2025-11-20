import { database } from '../helpers/database'

/**
 * Groups Model
 *
 * Provides query methods for groups SDE table
 */

export interface Group {
  groupId: number
  name: string
  categoryId: number
  iconId?: number
  published: number
}

/**
 * Get a single group by ID
 */
export async function getGroup(groupId: number): Promise<Group | null> {
  return await database.queryOne<Group>(
    'SELECT * FROM groups WHERE groupId = {id:UInt32}',
    { id: groupId }
  )
}

/**
 * Get all groups in a category
 */
export async function getGroupsByCategory(categoryId: number): Promise<Group[]> {
  return await database.query<Group>(
    'SELECT * FROM groups WHERE categoryId = {categoryId:UInt32} ORDER BY name',
    { categoryId }
  )
}

/**
 * Get published groups only
 */
export async function getPublishedGroups(): Promise<Group[]> {
  return await database.query<Group>(
    'SELECT * FROM groups WHERE published = 1 ORDER BY categoryId, name'
  )
}

/**
 * Search groups by name
 */
export async function searchGroups(namePattern: string, limit: number = 10): Promise<Group[]> {
  return await database.query<Group>(
    'SELECT * FROM groups WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get group name by ID
 */
export async function getGroupName(groupId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM groups WHERE groupId = {id:UInt32}',
    { id: groupId }
  )
  return result || null
}

/**
 * Count total groups
 */
export async function countGroups(): Promise<number> {
  return await database.count('groups')
}
