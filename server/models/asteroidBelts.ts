import { database } from '../helpers/database'

/**
 * Asteroid Belts Model
 *
 * Provides query methods for mapAsteroidBelts SDE table
 */

export interface AsteroidBelt {
  asteroidBeltId: number
  celestialIndex: number
  name: string
  positionX: number
  positionY: number
  positionZ: number
  solarSystemId: number
  typeId: number
}

/**
 * Get a single asteroid belt by ID
 */
export async function getAsteroidBelt(asteroidBeltId: number): Promise<AsteroidBelt | null> {
  return await database.queryOne<AsteroidBelt>(
    'SELECT * FROM edk.mapAsteroidBelts WHERE asteroidBeltId = {id:UInt32}',
    { id: asteroidBeltId }
  )
}

/**
 * Get all asteroid belts in a solar system
 */
export async function getAsteroidBeltsBySystem(solarSystemId: number): Promise<AsteroidBelt[]> {
  return await database.query<AsteroidBelt>(
    'SELECT * FROM edk.mapAsteroidBelts WHERE solarSystemId = {systemId:UInt32} ORDER BY celestialIndex',
    { systemId: solarSystemId }
  )
}

/**
 * Search asteroid belts by name
 */
export async function searchAsteroidBelts(namePattern: string, limit: number = 10): Promise<AsteroidBelt[]> {
  return await database.query<AsteroidBelt>(
    'SELECT * FROM edk.mapAsteroidBelts WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get asteroid belt name by ID
 */
export async function getAsteroidBeltName(asteroidBeltId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM edk.mapAsteroidBelts WHERE asteroidBeltId = {id:UInt32}',
    { id: asteroidBeltId }
  )
  return result || null
}

/**
 * Count total asteroid belts
 */
export async function countAsteroidBelts(): Promise<number> {
  return await database.count('edk.mapAsteroidBelts')
}
