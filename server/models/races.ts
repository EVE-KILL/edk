import { database } from '../helpers/database'

/**
 * Races Model
 *
 * Provides query methods for races SDE table
 */

export interface Race {
  raceId: number
  name: string
  description?: string
  iconId?: number
}

/**
 * Get a single race by ID
 */
export async function getRace(raceId: number): Promise<Race | null> {
  return await database.queryOne<Race>(
    'SELECT * FROM races WHERE raceId = {id:UInt32}',
    { id: raceId }
  )
}

/**
 * Get all races
 */
export async function getAllRaces(): Promise<Race[]> {
  return await database.query<Race>(
    'SELECT * FROM races ORDER BY name'
  )
}

/**
 * Search races by name
 */
export async function searchRaces(namePattern: string, limit: number = 10): Promise<Race[]> {
  return await database.query<Race>(
    'SELECT * FROM races WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get race name by ID
 */
export async function getRaceName(raceId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM races WHERE raceId = {id:UInt32}',
    { id: raceId }
  )
  return result || null
}

/**
 * Count total races
 */
export async function countRaces(): Promise<number> {
  return await database.count('races')
}
