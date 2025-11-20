import { database } from '../helpers/database'

/**
 * Stars Model
 *
 * Provides query methods for stars SDE table
 */

export interface Star {
  starId: number
  age: number
  luminosity: number
  name: string
  radius: number
  solarSystemId: number
  spectralClass: string
  temperature: number
  typeId: number
}

/**
 * Get a single star by ID
 */
export async function getStar(starId: number): Promise<Star | null> {
  return await database.queryOne<Star>(
    'SELECT * FROM stars FINAL WHERE starId = {id:UInt32}',
    { id: starId }
  )
}

/**
 * Get star in a solar system
 */
export async function getStarBySystem(solarSystemId: number): Promise<Star | null> {
  return await database.queryOne<Star>(
    'SELECT * FROM stars FINAL WHERE solarSystemId = {systemId:UInt32}',
    { systemId: solarSystemId }
  )
}

/**
 * Get all stars by spectral class
 */
export async function getStarsBySpectralClass(spectralClass: string): Promise<Star[]> {
  return await database.query<Star>(
    'SELECT * FROM stars FINAL WHERE spectralClass = {class:String} ORDER BY temperature DESC',
    { class: spectralClass }
  )
}

/**
 * Search stars by name
 */
export async function searchStars(namePattern: string, limit: number = 10): Promise<Star[]> {
  return await database.query<Star>(
    'SELECT * FROM stars FINAL WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get hottest stars
 */
export async function getHottestStars(limit: number = 10): Promise<Star[]> {
  return await database.query<Star>(
    'SELECT * FROM stars FINAL ORDER BY temperature DESC LIMIT {limit:UInt32}',
    { limit }
  )
}

/**
 * Count total stars
 */
export async function countStars(): Promise<number> {
  return await database.count('stars')
}
