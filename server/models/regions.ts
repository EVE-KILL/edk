import { database } from '../helpers/database'

/**
 * Regions Model
 *
 * Provides query methods for regions SDE table
 */

export interface Region {
  regionId: number
  constellationIds: number[]
  description?: string
  factionId?: number
  name: string
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
  const [row] = await database.sql<Region[]>`
    SELECT * FROM regions WHERE regionId = ${regionId}
  `
  return row || null
}

/**
 * Get all regions
 */
export async function getAllRegions(): Promise<Region[]> {
  return await database.sql<Region[]>`
    SELECT * FROM regions ORDER BY name
  `
}

/**
 * Search regions by name
 */
export async function searchRegions(namePattern: string, limit: number = 10): Promise<Region[]> {
  return await database.sql<Region[]>`
    SELECT * FROM regions
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `
}

/**
 * Get region name by ID
 */
export async function getRegionName(regionId: number): Promise<string | null> {
  const [result] = await database.sql<{name: string}[]>`
    SELECT name FROM regions WHERE regionId = ${regionId}
  `
  return result?.name || null
}

/**
 * Get regions by faction
 */
export async function getRegionsByFaction(factionId: number): Promise<Region[]> {
  return await database.sql<Region[]>`
    SELECT * FROM regions WHERE factionId = ${factionId} ORDER BY name
  `
}

/**
 * Count total regions
 */
export async function countRegions(): Promise<number> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM regions
  `
  return Number(result?.count || 0)
}
