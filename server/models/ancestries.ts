import { database } from '../helpers/database'

/**
 * Ancestries Model
 *
 * Provides query methods for ancestries SDE table
 */

export interface Ancestry {
  ancestryId: number
  name: string
  bloodlineId: number
  description?: string
  iconId?: number
  shortDescription?: string
}

/**
 * Get a single ancestry by ID
 */
export async function getAncestry(ancestryId: number): Promise<Ancestry | null> {
  return await database.queryOne<Ancestry>(
    'SELECT * FROM ancestries FINAL WHERE ancestryId = {id:UInt32}',
    { id: ancestryId }
  )
}

/**
 * Get all ancestries for a bloodline
 */
export async function getAncestriesByBloodline(bloodlineId: number): Promise<Ancestry[]> {
  return await database.query<Ancestry>(
    'SELECT * FROM ancestries FINAL WHERE bloodlineId = {bloodlineId:UInt32} ORDER BY name',
    { bloodlineId }
  )
}

/**
 * Get all ancestries
 */
export async function getAllAncestries(): Promise<Ancestry[]> {
  return await database.query<Ancestry>(
    'SELECT * FROM ancestries FINAL ORDER BY bloodlineId, name'
  )
}

/**
 * Search ancestries by name
 */
export async function searchAncestries(namePattern: string, limit: number = 10): Promise<Ancestry[]> {
  return await database.query<Ancestry>(
    'SELECT * FROM ancestries FINAL WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get ancestry name by ID
 */
export async function getAncestryName(ancestryId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM ancestries FINAL WHERE ancestryId = {id:UInt32}',
    { id: ancestryId }
  )
  return result || null
}

/**
 * Count total ancestries
 */
export async function countAncestries(): Promise<number> {
  return await database.count('ancestries')
}
