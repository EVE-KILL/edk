import { database } from '../helpers/database'

/**
 * Dogma Effects Model
 *
 * Provides query methods for dogmaEffects SDE table
 */

export interface DogmaEffect {
  effectId: number
  name: string
  categoryId?: number
  description?: string
  disallowAutoRepeat: number
  dischargeAttributeId?: number
  displayName?: string
  durationAttributeId?: number
  effectCategory?: string
  falloffAttributeId?: number
  fittingUsageChanceAttributeId?: number
  iconId?: number
  isAssistance: number
  isOffensive: number
  isWarpSafe: number
  neurotoxinId?: number
  npcActivationChanceAttributeId?: number
  npcUsageChanceAttributeId?: number
  published: number
  rangeAttributeId?: number
  resistanceAttributeId?: number
  softPenetrationAttributeId?: number
  trackingSpeedAttributeId?: number
}

/**
 * Get a single dogma effect by ID
 */
export async function getDogmaEffect(effectId: number): Promise<DogmaEffect | null> {
  return await database.queryOne<DogmaEffect>(
    'SELECT * FROM dogmaEffects WHERE effectId = {id:UInt32}',
    { id: effectId }
  )
}

/**
 * Get all published dogma effects
 */
export async function getPublishedDogmaEffects(): Promise<DogmaEffect[]> {
  return await database.query<DogmaEffect>(
    'SELECT * FROM dogmaEffects WHERE published = 1 ORDER BY name'
  )
}

/**
 * Get offensive dogma effects
 */
export async function getOffensiveDogmaEffects(): Promise<DogmaEffect[]> {
  return await database.query<DogmaEffect>(
    'SELECT * FROM dogmaEffects WHERE isOffensive = 1 ORDER BY name'
  )
}

/**
 * Get assistance dogma effects
 */
export async function getAssistanceDogmaEffects(): Promise<DogmaEffect[]> {
  return await database.query<DogmaEffect>(
    'SELECT * FROM dogmaEffects WHERE isAssistance = 1 ORDER BY name'
  )
}

/**
 * Get warp-safe dogma effects
 */
export async function getWarpSafeDogmaEffects(): Promise<DogmaEffect[]> {
  return await database.query<DogmaEffect>(
    'SELECT * FROM dogmaEffects WHERE isWarpSafe = 1 ORDER BY name'
  )
}

/**
 * Search dogma effects by name
 */
export async function searchDogmaEffects(namePattern: string, limit: number = 10): Promise<DogmaEffect[]> {
  return await database.query<DogmaEffect>(
    'SELECT * FROM dogmaEffects WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get dogma effect name by ID
 */
export async function getDogmaEffectName(effectId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM dogmaEffects WHERE effectId = {id:UInt32}',
    { id: effectId }
  )
  return result || null
}

/**
 * Count total dogma effects
 */
export async function countDogmaEffects(): Promise<number> {
  return await database.count('dogmaEffects')
}
