import { database } from '../helpers/database'

/**
 * Constellations Model
 *
 * Provides query methods for mapConstellations SDE table
 */

export interface Constellation {
  constellationId: number
  factionId?: number
  name: string
  positionX: number
  positionY: number
  positionZ: number
  regionId: number
  solarSystemIds: number[]
  wormholeClassId?: number
  updatedAt: string
}

/**
 * Get a single constellation by ID
 */
export async function getConstellation(constellationId: number): Promise<Constellation | null> {
  return await database.queryOne<Constellation>(
    'SELECT * FROM edk.mapConstellations WHERE constellationId = {id:UInt32}',
    { id: constellationId }
  )
}

/**
 * Get all constellations in a region
 */
export async function getConstellationsByRegion(regionId: number): Promise<Constellation[]> {
  return await database.query<Constellation>(
    'SELECT * FROM edk.mapConstellations WHERE regionId = {regionId:UInt32} ORDER BY name',
    { regionId }
  )
}

/**
 * Search constellations by name
 */
export async function searchConstellations(namePattern: string, limit: number = 10): Promise<Constellation[]> {
  return await database.query<Constellation>(
    `SELECT * FROM edk.mapConstellations 
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
    'SELECT name FROM edk.mapConstellations WHERE constellationId = {id:UInt32}',
    { id: constellationId }
  )
  return result || null
}

/**
 * Get constellations by faction
 */
export async function getConstellationsByFaction(factionId: number): Promise<Constellation[]> {
  return await database.query<Constellation>(
    'SELECT * FROM edk.mapConstellations WHERE factionId = {factionId:UInt32} ORDER BY name',
    { factionId }
  )
}

/**
 * Count total constellations
 */
export async function countConstellations(): Promise<number> {
  return await database.count('edk.mapConstellations')
}
