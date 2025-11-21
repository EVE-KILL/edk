import { database } from '../helpers/database'

/**
 * Constellations Model
 *
 * Provides query methods for constellations SDE table
 */

export interface Constellation {
  constellationId: number
  name: string
  regionId: number
  factionId?: number
  positionX: number
  positionY: number
  positionZ: number
  solarSystemIds: number[]
  wormholeClassId?: number
  updatedAt: Date
  version: number
}

/**
 * Get a single constellation by ID
 */
export async function getConstellation(constellationId: number): Promise<Constellation | null> {
  return await database.queryOne<Constellation>(
    'SELECT * FROM constellations WHERE constellationId = {id:UInt32}',
    { id: constellationId }
  )
}

/**
 * Get all constellations in a region
 */
export async function getConstellationsByRegion(regionId: number): Promise<Constellation[]> {
  return await database.query<Constellation>(
    'SELECT * FROM constellations WHERE regionId = {regionId:UInt32} ORDER BY name',
    { regionId }
  )
}

/**
 * Search constellations by name
 */
export async function searchConstellations(namePattern: string, limit: number = 10): Promise<Constellation[]> {
  return await database.query<Constellation>(
    `SELECT * FROM constellations
     WHERE name LIKE {pattern:String}
     ORDER BY name
     LIMIT {limit:UInt32}`,
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get constellation name by ID
 */
export async function getConstellationName(constellationId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM constellations WHERE constellationId = {id:UInt32}',
    { id: constellationId }
  )
  return result || null
}

/**
 * Get constellations by faction
 */
export async function getConstellationsByFaction(factionId: number): Promise<Constellation[]> {
  return await database.query<Constellation>(
    'SELECT * FROM constellations WHERE factionId = {factionId:UInt32} ORDER BY name',
    { factionId }
  )
}

/**
 * Count total constellations
 */
export async function countConstellations(): Promise<number> {
  return await database.count('constellations')
}
