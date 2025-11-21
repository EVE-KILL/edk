import { database } from '../helpers/database'

/**
 * Regions Model
 *
 * Provides query methods for regions SDE table
 */

export interface Region {
  regionId: number
  name: string
  constellationIds: number[]
  description: string
  factionId?: number
  nebulaId?: number
  positionX: number
  positionY: number
  positionZ: number
  wormholeClassId?: number
  updatedAt: Date
  version: number
}

/**
 * Get a single region by ID
 */
export async function getRegion(regionId: number): Promise<Region | null> {
  return await database.queryOne<Region>(
    'SELECT * FROM regions WHERE regionId = {id:UInt32}',
    { id: regionId }
  )
}

/**
 * Get all regions
 */
export async function getAllRegions(): Promise<Region[]> {
  return await database.query<Region>(
    'SELECT * FROM regions ORDER BY name'
  )
}

/**
 * Search regions by name
 */
export async function searchRegions(namePattern: string, limit: number = 10): Promise<Region[]> {
  return await database.query<Region>(
    `SELECT * FROM regions
     WHERE name LIKE {pattern:String}
     ORDER BY name
     LIMIT {limit:UInt32}`,
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get region name by ID
 */
export async function getRegionName(regionId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM regions WHERE regionId = {id:UInt32}',
    { id: regionId }
  )
  return result || null
}

/**
 * Get regions by faction
 */
export async function getRegionsByFaction(factionId: number): Promise<Region[]> {
  return await database.query<Region>(
    'SELECT * FROM regions WHERE factionId = {factionId:UInt32} ORDER BY name',
    { factionId }
  )
}

/**
 * Count total regions
 */
export async function countRegions(): Promise<number> {
  return await database.count('regions')
}
