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
  const [row] = await database.sql<Constellation[]>`
    SELECT * FROM constellations WHERE "constellationId" = ${constellationId}
  `
  return row || null
}

/**
 * Get all constellations in a region
 */
export async function getConstellationsByRegion(regionId: number): Promise<Constellation[]> {
  return await database.sql<Constellation[]>`
    SELECT * FROM constellations WHERE regionId = ${regionId} ORDER BY name
  `
}

/**
 * Search constellations by name
 */
export async function searchConstellations(namePattern: string, limit: number = 10): Promise<Constellation[]> {
  return await database.sql<Constellation[]>`
    SELECT * FROM constellations
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `
}

/**
 * Get constellation name by ID
 */
export async function getConstellationName(constellationId: number): Promise<string | null> {
  const [row] = await database.sql<{ name: string }[]>`
    SELECT name FROM constellations WHERE "constellationId" = ${constellationId}
  `
  return row?.name || null
}

/**
 * Get constellations by faction
 */
export async function getConstellationsByFaction(factionId: number): Promise<Constellation[]> {
  return await database.sql<Constellation[]>`
    SELECT * FROM constellations WHERE factionId = ${factionId} ORDER BY name
  `
}

/**
 * Count total constellations
 */
export async function countConstellations(): Promise<number> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM constellations
  `
  return Number(result?.count || 0)
}
