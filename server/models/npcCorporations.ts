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
  const [row] = await database.sql<NPCCorporation[]>`
    SELECT * FROM npccorporations WHERE "corporationId" = ${corporationId}
  `
  return row || null
}

/**
 * Get all NPC corporations for a faction
 */
export async function getNPCCorporationsByFaction(factionId: number): Promise<NPCCorporation[]> {
  return await database.sql<NPCCorporation[]>`
    SELECT * FROM npccorporations WHERE "factionId" = ${factionId} ORDER BY name
  `
}

/**
 * Get active (non-deleted) NPC corporations
 */
export async function getActiveNPCCorporations(): Promise<NPCCorporation[]> {
  return await database.sql<NPCCorporation[]>`
    SELECT * FROM npccorporations WHERE deleted = false ORDER BY name
  `
}

/**
 * Search NPC corporations by name
 */
export async function searchNPCCorporations(namePattern: string, limit: number = 10): Promise<NPCCorporation[]> {
  return await database.sql<NPCCorporation[]>`
    SELECT * FROM npccorporations
    WHERE name ILIKE ${`%${namePattern}%`}
    ORDER BY name
    LIMIT ${limit}
  `
}

/**
 * Get NPC corporation name by ID
 */
export async function getNPCCorporationName(corporationId: number): Promise<string | null> {
  const [result] = await database.sql<{name: string}[]>`
    SELECT name FROM npccorporations WHERE "corporationId" = ${corporationId}
  `
  return result?.name || null
}

/**
 * Count total NPC corporations
 */
export async function countNPCCorporations(): Promise<number> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM npccorporations
  `
  return Number(result?.count || 0)
}
