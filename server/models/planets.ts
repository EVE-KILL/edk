import { database } from '../helpers/database'

/**
 * Planets Model
 *
 * Provides query methods for planets SDE table
 */

export interface Planet {
  planetId: number
  celestialIndex: number
  name: string
  positionX: number
  positionY: number
  positionZ: number
  solarSystemId: number
  typeId: number
}

/**
 * Get a single planet by ID
 */
export async function getPlanet(planetId: number): Promise<Planet | null> {
  const [row] = await database.sql<Planet[]>`
    SELECT * FROM planets WHERE planetId = ${planetId}
  `
  return row || null
}

/**
 * Get all planets in a solar system
 */
export async function getPlanetsBySystem(solarSystemId: number): Promise<Planet[]> {
  return await database.sql<Planet[]>`
    SELECT * FROM planets WHERE solarSystemId = ${solarSystemId} ORDER BY celestialIndex
  `
}

/**
 * Search planets by name
 */
export async function searchPlanets(namePattern: string, limit: number = 10): Promise<Planet[]> {
  return await database.sql<Planet[]>`
    SELECT * FROM planets
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `
}

/**
 * Get planet name by ID
 */
export async function getPlanetName(planetId: number): Promise<string | null> {
  const [result] = await database.sql<{name: string}[]>`
    SELECT name FROM planets WHERE planetId = ${planetId}
  `
  return result?.name || null
}

/**
 * Count total planets
 */
export async function countPlanets(): Promise<number> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM planets
  `
  return Number(result?.count || 0)
}
