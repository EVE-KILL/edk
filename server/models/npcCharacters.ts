import { database } from '../helpers/database'

/**
 * NPC Characters Model
 *
 * Provides query methods for npcCharacters SDE table
 */

export interface NPCCharacter {
  characterId: number
  name: string
  corporationId?: number
  allianceId?: number
  bloodlineId?: number
  ancestryId?: number
  gender?: number
  raceId?: number
}

/**
 * Get a single NPC character by ID
 */
export async function getNPCCharacter(characterId: number): Promise<NPCCharacter | null> {
  return await database.queryOne<NPCCharacter>(
    'SELECT * FROM npcCharacters FINAL WHERE characterId = {id:UInt32}',
    { id: characterId }
  )
}

/**
 * Get all NPC characters in a corporation
 */
export async function getNPCCharactersByCorporation(corporationId: number): Promise<NPCCharacter[]> {
  return await database.query<NPCCharacter>(
    'SELECT * FROM npcCharacters FINAL WHERE corporationId = {corporationId:UInt32} ORDER BY name',
    { corporationId }
  )
}

/**
 * Get all NPC characters of a bloodline
 */
export async function getNPCCharactersByBloodline(bloodlineId: number): Promise<NPCCharacter[]> {
  return await database.query<NPCCharacter>(
    'SELECT * FROM npcCharacters FINAL WHERE bloodlineId = {bloodlineId:UInt32} ORDER BY name',
    { bloodlineId }
  )
}

/**
 * Search NPC characters by name
 */
export async function searchNPCCharacters(namePattern: string, limit: number = 10): Promise<NPCCharacter[]> {
  return await database.query<NPCCharacter>(
    'SELECT * FROM npcCharacters FINAL WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get NPC character name by ID
 */
export async function getNPCCharacterName(characterId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM npcCharacters FINAL WHERE characterId = {id:UInt32}',
    { id: characterId }
  )
  return result || null
}

/**
 * Count total NPC characters
 */
export async function countNPCCharacters(): Promise<number> {
  return await database.count('npcCharacters')
}
