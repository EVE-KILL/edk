import { database } from '../helpers/database'

/**
 * Asteroid Belts Model
 *
 * Provides query methods for asteroidBelts SDE table
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
  const [row] = await database.sql<AsteroidBelt[]>`
    SELECT * FROM asteroidBelts WHERE asteroidBeltId = ${asteroidBeltId}
  `
  return row || null
}

/**
 * Get all asteroid belts in a solar system
 */
export async function getAsteroidBeltsBySystem(solarSystemId: number): Promise<AsteroidBelt[]> {
  return await database.sql<AsteroidBelt[]>`
    SELECT * FROM asteroidBelts WHERE solarSystemId = ${solarSystemId} ORDER BY celestialIndex
  `
}

/**
 * Search asteroid belts by name
 */
export async function searchAsteroidBelts(namePattern: string, limit: number = 10): Promise<AsteroidBelt[]> {
  return await database.sql<AsteroidBelt[]>`
    SELECT * FROM asteroidBelts
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `
}
