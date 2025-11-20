import { database } from '../helpers/database'

/**
 * Killmails ESI Model
 *
 * Queries the killmails_esi materialized view
 * Contains pre-computed ESI-formatted killmails for instant API responses
 */

export interface KillmailESI {
  killmailId: number
  killmailTime: Date
  solarSystemId: number

  // Victim data
  victimCharacterId: number
  victimCorporationId: number
  victimAllianceId: number
  victimShipTypeId: number
  victimDamageTaken: number
  victimPosition: string // JSON: {x, y, z}

  // Pre-serialized arrays
  attackers: string // JSON array
  items: string // JSON array

  // Metadata
  totalValue: number
  attackerCount: number
  npc: boolean
  solo: boolean
  awox: boolean

  version: number
}

/**
 * Get killmail in ESI format (pre-computed)
 */
export async function getKillmailESI(killmailId: number): Promise<KillmailESI | null> {
  return await database.queryOne<KillmailESI>(
    'SELECT * FROM killmails_esi WHERE killmailId = {id:UInt32} FINAL',
    { id: killmailId }
  )
}

/**
 * Get multiple killmails in ESI format
 */
export async function getKillmailsESI(killmailIds: number[]): Promise<KillmailESI[]> {
  if (killmailIds.length === 0) return []

  return await database.query<KillmailESI>(
    `SELECT * FROM killmails_esi
     WHERE killmailId IN ({ids:Array(UInt32)}) FINAL
     ORDER BY killmailTime DESC`,
    { ids: killmailIds }
  )
}

/**
 * Get recent killmails in ESI format
 */
export async function getRecentKillmailsESI(limit: number = 50): Promise<KillmailESI[]> {
  return await database.query<KillmailESI>(
    `SELECT * FROM killmails_esi FINAL
     ORDER BY killmailTime DESC, killmailId DESC
     LIMIT {limit:UInt32}`,
    { limit }
  )
}

/**
 * Check if killmail exists in ESI cache
 */
export async function killmailESIExists(killmailId: number): Promise<boolean> {
  const result = await database.queryValue<number>(
    'SELECT count() FROM killmails_esi WHERE killmailId = {id:UInt32} FINAL',
    { id: killmailId }
  )
  return (result || 0) > 0
}
