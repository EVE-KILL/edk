import { database } from '../helpers/database'

/**
 * NPC Corporations Model
 *
 * Provides query methods for npcCorporations SDE table
 */

export interface NPCCorporation {
  corporationId: number
  name: string
  description?: string
  ceoId?: number
  factionId?: number
  solarSystemId?: number
  stationId?: number
  taxRate?: number
  tickerName?: string
  deleted: number
}

/**
 * Get a single NPC corporation by ID
 */
export async function getNPCCorporation(corporationId: number): Promise<NPCCorporation | null> {
  return await database.queryOne<NPCCorporation>(
    'SELECT * FROM npcCorporations WHERE corporationId = {id:UInt32}',
    { id: corporationId }
  )
}

/**
 * Get all NPC corporations for a faction
 */
export async function getNPCCorporationsByFaction(factionId: number): Promise<NPCCorporation[]> {
  return await database.query<NPCCorporation>(
    'SELECT * FROM npcCorporations WHERE factionId = {factionId:UInt32} ORDER BY name',
    { factionId }
  )
}

/**
 * Get active (non-deleted) NPC corporations
 */
export async function getActiveNPCCorporations(): Promise<NPCCorporation[]> {
  return await database.query<NPCCorporation>(
    'SELECT * FROM npcCorporations WHERE deleted = 0 ORDER BY name'
  )
}

/**
 * Search NPC corporations by name
 */
export async function searchNPCCorporations(namePattern: string, limit: number = 10): Promise<NPCCorporation[]> {
  return await database.query<NPCCorporation>(
    'SELECT * FROM npcCorporations WHERE name LIKE {pattern:String} ORDER BY name LIMIT {limit:UInt32}',
    { pattern: `%${namePattern}%`, limit }
  )
}

/**
 * Get NPC corporation name by ID
 */
export async function getNPCCorporationName(corporationId: number): Promise<string | null> {
  const result = await database.queryValue<string>(
    'SELECT name FROM npcCorporations WHERE corporationId = {id:UInt32}',
    { id: corporationId }
  )
  return result || null
}

/**
 * Count total NPC corporations
 */
export async function countNPCCorporations(): Promise<number> {
  return await database.count('npcCorporations')
}
