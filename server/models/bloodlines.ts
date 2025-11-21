import { database } from '../helpers/database'

/**
 * Bloodlines Model
 *
 * Provides query methods for bloodlines SDE table
 */

export interface Bloodline {
  bloodlineId: number
  name: string
  description?: string
  raceId: number
  shipTypeId?: number
  corporationId?: number
  charisma?: number
  constitution?: number
  intelligence?: number
  memory?: number
  perception?: number
  willpower?: number
}

/**
 * Get a single bloodline by ID
 */
export async function getBloodline(bloodlineId: number): Promise<Bloodline | null> {
  return await database.queryOne<Bloodline>(
    'SELECT * FROM bloodlines WHERE bloodlineId = {id:UInt32}',
    { id: bloodlineId }
  )
}

/**
 * Get all bloodlines for a race
 */
export async function getBloodlinesByRace(raceId: number): Promise<Bloodline[]> {
  return await database.query<Bloodline>(
    'SELECT * FROM bloodlines WHERE raceId = {raceId:UInt32} ORDER BY name',
    { raceId }
  )
}

/**
 * Get all bloodlines
 */
export async function getAllBloodlines(): Promise<Bloodline[]> {
  return await database.query<Bloodline>(
    'SELECT * FROM bloodlines ORDER BY raceId, name'
  )
}

/**
 * Search bloodlines by name
 */
export async function searchBloodlines(namePattern: string, limit: number = 10): Promise<Bloodline[]> {
  return await database.query<Bloodline>(
    'SELECT * FROM bloodlines WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get bloodline name by ID
 */
export async function getBloodlineName(bloodlineId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM bloodlines WHERE bloodlineId = {id:UInt32}',
    { id: bloodlineId }
  )
  return result || null
}

/**
 * Count total bloodlines
 */
export async function countBloodlines(): Promise<number> {
  return await database.count('bloodlines')
}
