import { database } from '../helpers/database'

/**
 * Killmails ESI Model
 *
 * Provides query methods for killmails_esi materialized view
 * Reconstructs killmails in the exact ESI API format
 */

/**
 * ESI Killmail format - Matches EXACTLY what ESI API returns
 * See: https://esi.evetech.net/latest/killmails/{id}/{hash}
 */
export interface ESIKillmail {
  killmail_id: number
  killmail_time: string
  solar_system_id: number
  victim: {
    alliance_id: number | null
    character_id: number | null
    corporation_id: number
    damage_taken: number
    ship_type_id: number
    position: {
      x: number
      y: number
      z: number
    }
    items: Array<{
      flag: number
      item_type_id: number
      quantity_dropped: number
      quantity_destroyed: number
      singleton: number
    }>
  }
  attackers: Array<{
    alliance_id: number | null
    character_id: number | null
    corporation_id: number | null
    damage_done: number
    final_blow: boolean
    security_status: number
    ship_type_id: number | null
    weapon_type_id: number | null
  }>
}

/**
 * Get a single killmail by ID and reconstruct to ESI format
 */
export async function getKillmail(killmailId: number): Promise<ESIKillmail | null> {
  const killmailRow = await database.queryOne<any>(
    'SELECT * FROM edk.killmails_esi WHERE killmail_id = {id:UInt32}',
    { id: killmailId }
  )

  if (!killmailRow) {
    return null
  }

  return reconstructFromView(killmailRow)
}

/**
 * Get multiple killmails by IDs
 */
export async function getKillmails(killmailIds: number[]): Promise<ESIKillmail[]> {
  const placeholders = killmailIds.map((_, i) => `{id${i}:UInt32}`).join(',')
  const params: Record<string, number> = {}
  killmailIds.forEach((id, i) => {
    params[`id${i}`] = id
  })

  const results = await database.query<any>(
    `SELECT * FROM edk.killmails_esi WHERE killmail_id IN (${placeholders})`,
    params
  )

  return results.map(reconstructFromView)
}

/**
 * Get all killmails in a solar system
 */
export async function getKillmailsBySystem(solarSystemId: number, limit: number = 100): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    'SELECT * FROM edk.killmails_esi WHERE solar_system_id = {systemId:UInt32} ORDER BY killmail_time DESC LIMIT {limit:UInt32}',
    { systemId: solarSystemId, limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get all killmails for a victim character
 */
export async function getKillmailsByVictimCharacter(
  characterId: number,
  limit: number = 100
): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    'SELECT * FROM edk.killmails_esi WHERE victim_character_id = {charId:UInt32} ORDER BY killmail_time DESC LIMIT {limit:UInt32}',
    { charId: characterId, limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get all killmails for a victim corporation
 */
export async function getKillmailsByVictimCorporation(
  corporationId: number,
  limit: number = 100
): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    'SELECT * FROM edk.killmails_esi WHERE victim_corporation_id = {corpId:UInt32} ORDER BY killmail_time DESC LIMIT {limit:UInt32}',
    { corpId: corporationId, limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get all killmails for a victim alliance
 */
export async function getKillmailsByVictimAlliance(
  allianceId: number,
  limit: number = 100
): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    'SELECT * FROM edk.killmails_esi WHERE victim_alliance_id = {allianceId:UInt32} ORDER BY killmail_time DESC LIMIT {limit:UInt32}',
    { allianceId, limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get all killmails where a character was an attacker
 */
export async function getKillmailsByAttackerCharacter(
  characterId: number,
  limit: number = 100
): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    `SELECT DISTINCT km.* FROM edk.killmails_esi km
     WHERE arrayExists(a -> a[1] = {charId:UInt32}, attackers_array)
     ORDER BY killmail_time DESC LIMIT {limit:UInt32}`,
    { charId: characterId, limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get all killmails where a corporation was involved (victim or attacker)
 */
export async function getKillmailsByCorporation(
  corporationId: number,
  limit: number = 100
): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    `SELECT DISTINCT km.* FROM edk.killmails_esi km
     WHERE victim_corporation_id = {corpId:UInt32}
        OR arrayExists(a -> a[2] = {corpId:UInt32}, attackers_array)
     ORDER BY killmail_time DESC LIMIT {limit:UInt32}`,
    { corpId: corporationId, limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get killmails involving a specific ship type as victim
 */
export async function getKillmailsByVictimShip(
  shipTypeId: number,
  limit: number = 100
): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    'SELECT * FROM edk.killmails_esi WHERE victim_ship_type_id = {shipId:UInt32} ORDER BY killmail_time DESC LIMIT {limit:UInt32}',
    { shipId: shipTypeId, limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get killmails in a time range
 */
export async function getKillmailsByTimeRange(
  startTime: Date,
  endTime: Date,
  limit: number = 1000
): Promise<ESIKillmail[]> {
  const startStr = startTime.toISOString()
  const endStr = endTime.toISOString()

  const results = await database.query<any>(
    `SELECT * FROM edk.killmails_esi
     WHERE killmail_time >= {start:String} AND killmail_time < {end:String}
     ORDER BY killmail_time DESC LIMIT {limit:UInt32}`,
    { start: startStr, end: endStr, limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get highest damage killmails
 */
export async function getHighestDamageKillmails(limit: number = 100): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    'SELECT * FROM edk.killmails_esi ORDER BY victim_damage_taken DESC LIMIT {limit:UInt32}',
    { limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Get latest killmails
 */
export async function getLatestKillmails(limit: number = 100): Promise<ESIKillmail[]> {
  const results = await database.query<any>(
    'SELECT * FROM edk.killmails_esi ORDER BY killmail_time DESC LIMIT {limit:UInt32}',
    { limit }
  )
  return results.map(reconstructFromView)
}

/**
 * Count total killmails
 */
export async function countKillmails(): Promise<number> {
  return await database.count('edk.killmails_esi')
}

/**
 * Count killmails in a system
 */
export async function countKillmailsInSystem(solarSystemId: number): Promise<number> {
  const result = await database.queryOne<any>(
    'SELECT count() as cnt FROM edk.killmails_esi WHERE solar_system_id = {systemId:UInt32}',
    { systemId: solarSystemId }
  )
  return result?.cnt || 0
}

/**
 * Format an ESI API response into our standard structure
 * (useful when you get data directly from ESI API)
 */
export function formatESIResponse(esiData: any): ESIKillmail {
  return {
    killmail_id: esiData.killmail_id,
    killmail_time: esiData.killmail_time,
    solar_system_id: esiData.solar_system_id,
    victim: {
      alliance_id: esiData.victim.alliance_id || null,
      character_id: esiData.victim.character_id || null,
      corporation_id: esiData.victim.corporation_id,
      damage_taken: esiData.victim.damage_taken,
      ship_type_id: esiData.victim.ship_type_id,
      position: {
        x: esiData.victim.position?.x || null,
        y: esiData.victim.position?.y || null,
        z: esiData.victim.position?.z || null
      },
      items: (esiData.victim.items || []).map((item: any) => ({
        flag: item.flag,
        item_type_id: item.item_type_id,
        quantity_dropped: item.quantity_dropped || 0,
        quantity_destroyed: item.quantity_destroyed || 0,
        singleton: item.singleton || 0
      }))
    },
    attackers: (esiData.attackers || []).map((attacker: any) => ({
      alliance_id: attacker.alliance_id || null,
      character_id: attacker.character_id || null,
      corporation_id: attacker.corporation_id || null,
      damage_done: attacker.damage_done,
      final_blow: attacker.final_blow,
      security_status: attacker.security_status || null,
      ship_type_id: attacker.ship_type_id || null,
      weapon_type_id: attacker.weapon_type_id || null
    }))
  }
}

/**
 * Helper: Reconstruct ESI killmail from materialized view row
 */
function reconstructFromView(killmailRow: any): ESIKillmail {
  return {
    killmail_id: killmailRow.killmail_id,
    killmail_time: killmailRow.killmail_time,
    solar_system_id: killmailRow.solar_system_id,
    victim: {
      alliance_id: killmailRow.victim_alliance_id,
      character_id: killmailRow.victim_character_id,
      corporation_id: killmailRow.victim_corporation_id,
      damage_taken: killmailRow.victim_damage_taken,
      ship_type_id: killmailRow.victim_ship_type_id,
      position: {
        x: killmailRow.victim_position_x,
        y: killmailRow.victim_position_y,
        z: killmailRow.victim_position_z
      },
      items: killmailRow.items_array.map((item: any) => ({
        flag: item[0],
        item_type_id: item[1],
        quantity_dropped: item[2],
        quantity_destroyed: item[3],
        singleton: item[4]
      }))
    },
    attackers: killmailRow.attackers_array.map((attacker: any) => ({
      alliance_id: attacker[0],
      character_id: attacker[1],
      corporation_id: attacker[2],
      damage_done: attacker[3],
      final_blow: attacker[4] === 1,
      security_status: attacker[5],
      ship_type_id: attacker[6],
      weapon_type_id: attacker[7]
    }))
  }
}
