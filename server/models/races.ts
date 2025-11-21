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
  const [row] = await database.sql<Race[]>`
    SELECT * FROM races WHERE raceId = ${raceId}
  `
  return row || null
}

/**
 * Get all races
 */
export async function getAllRaces(): Promise<Race[]> {
  return await database.sql<Race[]>`
    SELECT * FROM races ORDER BY name
  `
}

/**
 * Search races by name
 */
export async function searchRaces(namePattern: string, limit: number = 10): Promise<Race[]> {
  return await database.sql<Race[]>`
    SELECT * FROM races
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `
}

/**
 * Get race name by ID
 */
export async function getRaceName(raceId: number): Promise<string | null> {
  const [result] = await database.sql<{name: string}[]>`
    SELECT name FROM races WHERE raceId = ${raceId}
  `
  return result?.name || null
}

/**
 * Count total races
 */
export async function countRaces(): Promise<number> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM races
  `
  return Number(result?.count || 0)
}
