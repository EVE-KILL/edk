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
  return await database.queryOne<Planet>(
    'SELECT * FROM planets WHERE planetId = {id:UInt32}',
    { id: planetId }
  )
}

/**
 * Get all planets in a solar system
 */
export async function getPlanetsBySystem(solarSystemId: number): Promise<Planet[]> {
  return await database.query<Planet>(
    'SELECT * FROM planets WHERE solarSystemId = {systemId:UInt32} ORDER BY celestialIndex',
    { systemId: solarSystemId }
  )
}

/**
 * Search planets by name
 */
export async function searchPlanets(namePattern: string, limit: number = 10): Promise<Planet[]> {
  return await database.query<Planet>(
    'SELECT * FROM planets WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get planet name by ID
 */
export async function getPlanetName(planetId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM planets WHERE planetId = {id:UInt32}',
    { id: planetId }
  )
  return result || null
}

/**
 * Count total planets
 */
export async function countPlanets(): Promise<number> {
  return await database.count('planets')
}
