import { database } from '../helpers/database'

/**
 * Station Operations Model
 *
 * Provides query methods for stationOperations SDE table
 */

export interface StationOperation {
  operationId: number
  name: string
  description?: string
  activityId?: number
  border?: number
  corridor?: number
  fringe?: number
  hub?: number
  manufacturingFactor?: number
  ratio?: number
  researchFactor?: number
  stationType?: string
}

/**
 * Get a single station operation by ID
 */
export async function getStationOperation(operationId: number): Promise<StationOperation | null> {
  return await database.queryOne<StationOperation>(
    'SELECT * FROM edk.stationOperations WHERE operationId = {id:UInt32}',
    { id: operationId }
  )
}

/**
 * Get all station operations
 */
export async function getAllStationOperations(): Promise<StationOperation[]> {
  return await database.query<StationOperation>(
    'SELECT * FROM edk.stationOperations ORDER BY name'
  )
}

/**
 * Get station operations by type
 */
export async function getStationOperationsByType(stationType: string): Promise<StationOperation[]> {
  return await database.query<StationOperation>(
    'SELECT * FROM edk.stationOperations WHERE stationType = {type:String} ORDER BY name',
    { type: stationType }
  )
}

/**
 * Search station operations by name
 */
export async function searchStationOperations(namePattern: string, limit: number = 10): Promise<StationOperation[]> {
  return await database.query<StationOperation>(
    'SELECT * FROM edk.stationOperations WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get station operation name by ID
 */
export async function getStationOperationName(operationId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM edk.stationOperations WHERE operationId = {id:UInt32}',
    { id: operationId }
  )
  return result || null
}

/**
 * Count total station operations
 */
export async function countStationOperations(): Promise<number> {
  return await database.count('edk.stationOperations')
}
