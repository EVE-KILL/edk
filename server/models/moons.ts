import { database } from '../helpers/database'

/**
 * Moons Model
 *
 * Provides query methods for moons SDE table
 */

export interface Moon {
  moonId: number
  celestialIndex: number
  name: string
  planetId: number
  positionX: number
  positionY: number
  positionZ: number
  solarSystemId: number
  typeId: number
}

/**
 * Get a single moon by ID
 */
export async function getMoon(moonId: number): Promise<Moon | null> {
  return await database.queryOne<Moon>(
    'SELECT * FROM moons WHERE moonId = {id:UInt32}',
    { id: moonId }
  )
}

/**
 * Get all moons orbiting a planet
 */
export async function getMoonsByPlanet(planetId: number): Promise<Moon[]> {
  return await database.query<Moon>(
    'SELECT * FROM moons WHERE planetId = {planetId:UInt32} ORDER BY celestialIndex',
    { planetId }
  )
}

/**
 * Get all moons in a solar system
 */
export async function getMoonsBySystem(solarSystemId: number): Promise<Moon[]> {
  return await database.query<Moon>(
    'SELECT * FROM moons WHERE solarSystemId = {systemId:UInt32} ORDER BY name',
    { systemId: solarSystemId }
  )
}

/**
 * Search moons by name
 */
export async function searchMoons(namePattern: string, limit: number = 10): Promise<Moon[]> {
  return await database.query<Moon>(
    'SELECT * FROM moons WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get moon name by ID
 */
export async function getMoonName(moonId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM moons WHERE moonId = {id:UInt32}',
    { id: moonId }
  )
  return result || null
}

/**
 * Count total moons
 */
export async function countMoons(): Promise<number> {
  return await database.count('moons')
}
