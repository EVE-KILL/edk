import { database } from '../helpers/database'

/**
 * Stargates Model
 *
 * Provides query methods for stargates SDE table
 */

export interface Stargate {
  stargateId: number
  name: string
  positionX: number
  positionY: number
  positionZ: number
  solarSystemId: number
  destinationGateId: number
  destinationSolarSystemId: number
  typeId: number
}

/**
 * Get a single stargate by ID
 */
export async function getStargate(stargateId: number): Promise<Stargate | null> {
  return await database.queryOne<Stargate>(
    'SELECT * FROM stargates FINAL WHERE stargateId = {id:UInt32}',
    { id: stargateId }
  )
}

/**
 * Get all stargates in a solar system
 */
export async function getStargatesBySystem(solarSystemId: number): Promise<Stargate[]> {
  return await database.query<Stargate>(
    'SELECT * FROM stargates FINAL WHERE solarSystemId = {systemId:UInt32} ORDER BY name',
    { systemId: solarSystemId }
  )
}

/**
 * Get stargate destination
 */
export async function getStargateDestination(stargateId: number): Promise<{ gateId: number; systemId: number } | null> {
  const result = await database.queryOne<any>(
    'SELECT destinationGateId, destinationSolarSystemId FROM stargates FINAL WHERE stargateId = {id:UInt32}',
    { id: stargateId }
  )
  return result ? { gateId: result.destinationGateId, systemId: result.destinationSolarSystemId } : null
}

/**
 * Search stargates by name
 */
export async function searchStargates(namePattern: string, limit: number = 10): Promise<Stargate[]> {
  return await database.query<Stargate>(
    'SELECT * FROM stargates FINAL WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get stargate name by ID
 */
export async function getStargateName(stargateId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM stargates FINAL WHERE stargateId = {id:UInt32}',
    { id: stargateId }
  )
  return result || null
}

/**
 * Count total stargates
 */
export async function countStargates(): Promise<number> {
  return await database.count('stargates')
}
