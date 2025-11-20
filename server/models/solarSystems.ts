import { database } from '../helpers/database'

/**
 * Solar Systems Model
 *
 * Provides query methods for solarSystems SDE table
 */

export interface SolarSystem {
  solarSystemId: number
  border: number
  constellationId: number
  corridor: number
  factionId?: number
  fringe: number
  hub: number
  international: number
  luminosity: number
  name: string
  planetIds: number[]
  positionX: number
  positionY: number
  positionZ: number
  radius: number
  regional: number
  regionId: number
  securityClass: string
  securityStatus: number
  stargateIds: number[]
  starId: number
  visualEffect: string
  wormholeClassId?: number
  updatedAt: string
}

/**
 * Get a single solar system by ID
 */
export async function getSolarSystem(solarSystemId: number): Promise<SolarSystem | null> {
  return await database.queryOne<SolarSystem>(
    'SELECT * FROM solarSystems WHERE "solarSystemId" = {id:UInt32}',
    { id: solarSystemId }
  )
}

/**
 * Get all solar systems in a region
 */
export async function getSolarSystemsByRegion(regionId: number): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    'SELECT * FROM solarSystems WHERE "regionId" = {regionId:UInt32} ORDER BY name',
    { regionId }
  )
}

/**
 * Get all solar systems in a constellation
 */
export async function getSolarSystemsByConstellation(constellationId: number): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    'SELECT * FROM solarSystems WHERE "constellationId" = {constellationId:UInt32} ORDER BY name',
    { constellationId }
  )
}

/**
 * Search solar systems by name
 */
export async function searchSolarSystems(namePattern: string, limit: number = 10): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    `SELECT * FROM solarSystems
     WHERE name LIKE {pattern:String}
     ORDER BY name
     LIMIT {limit:UInt32}`,
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get solar system name by ID
 */
export async function getSolarSystemName(solarSystemId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM solarSystems WHERE "solarSystemId" = {id:UInt32}',
    { id: solarSystemId }
  )
  return result || null
}

/**
 * Get high/low/null security systems in a region
 */
export async function getSecurityClassSystems(
  regionId: number,
  securityClass: 'A' | 'B' | 'C',
): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    `SELECT * FROM solarSystems
     WHERE "regionId" = {regionId:UInt32} AND "securityClass" = {class:String}
     ORDER BY "securityStatus" DESC`,
    { regionId, class: securityClass }
  )
}

/**
 * Get trade hubs
 */
export async function getTradeHubs(): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    'SELECT * FROM solarSystems WHERE hub = 1 ORDER BY "regionId", name'
  )
}

/**
 * Get all solar systems in a region
 */
export async function getSolarSystemsByRegion(regionId: number): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    'SELECT * FROM solarSystems WHERE regionId = {regionId:UInt32} ORDER BY name',
    { regionId }
  )
}

/**
 * Get all solar systems in a constellation
 */
export async function getSolarSystemsByConstellation(constellationId: number): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    'SELECT * FROM solarSystems WHERE constellationId = {constellationId:UInt32} ORDER BY name',
    { constellationId }
  )
}

/**
 * Search solar systems by name
 */
export async function searchSolarSystems(namePattern: string, limit: number = 10): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    `SELECT * FROM solarSystems
     WHERE name LIKE {pattern:String}
     ORDER BY name
     LIMIT {limit:UInt32}`,
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get solar system name by ID
 */
export async function getSolarSystemName(solarSystemId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM solarSystems WHERE solarSystemId = {id:UInt32}',
    { id: solarSystemId }
  )
  return result || null
}

/**
 * Get high/low/null security systems in a region
 */
export async function getSecurityClassSystems(
  regionId: number,
  securityClass: 'A' | 'B' | 'C',
): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    `SELECT * FROM solarSystems
     WHERE regionId = {regionId:UInt32} AND securityClass = {class:String}
     ORDER BY securityStatus DESC`,
    { regionId, class: securityClass }
  )
}

/**
 * Get hub systems
 */
export async function getHubSystems(): Promise<SolarSystem[]> {
  return await database.query<SolarSystem>(
    'SELECT * FROM solarSystems WHERE hub = 1 ORDER BY regionId, name',
  )
}

/**
 * Count total solar systems
 */
export async function countSolarSystems(): Promise<number> {
  return await database.count('solarSystems')
}
