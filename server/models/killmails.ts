import { database } from '../helpers/database'
import { logger } from '../helpers/logger'
import { createHash } from 'crypto'

/**
 * Killmails Model
 *
 * Provides query methods for killmails table
 */

export interface Killmail {
  killmailId: number
  killmailTime: string
  solarSystemId: number
  victimAllianceId?: number
  victimCharacterId: number
  victimCorporationId: number
  victimDamageTaken: number
  victimShipTypeId: number
  positionX: number
  positionY: number
  positionZ: number
  createdAt: string
  version: number
}

/**
 * ESI Killmail format - matches exactly what ESI API returns/expects
 * Used for both input (from ESI) and output (to our API)
 */
export interface ESIKillmail {
  killmail_id: number
  killmail_time: string
  solar_system_id: number
  victim: {
    alliance_id?: number
    character_id?: number
    corporation_id: number
    damage_taken: number
    ship_type_id: number
    position?: {
      x: number
      y: number
      z: number
    }
    items?: Array<{
      flag: number
      item_type_id: number
      quantity_dropped?: number
      quantity_destroyed?: number
      singleton: number
    }>
  }
  attackers: Array<{
    alliance_id?: number
    character_id?: number
    corporation_id?: number
    damage_done: number
    final_blow: boolean
    security_status: number
    ship_type_id?: number
    weapon_type_id?: number
  }>
}

/**
 * Get a killmail by ID in ESI format
 * Reconstructs the killmail from the database tables
 */
export async function getKillmail(killmailId: number): Promise<ESIKillmail | null> {
  // Get main killmail record
  const killmail = await database.queryOne<any>(
    'SELECT * FROM edk.killmails WHERE killmailId = {id:UInt32}',
    { id: killmailId }
  )

  if (!killmail) {
    return null
  }

  // Get attackers
  const attackers = await database.query<any>(
    'SELECT * FROM edk.attackers WHERE killmailId = {id:UInt32}',
    { id: killmailId }
  )

  // Get items
  const items = await database.query<any>(
    'SELECT * FROM edk.items WHERE killmailId = {id:UInt32}',
    { id: killmailId }
  )

  // Convert Unix timestamp back to ISO string
  // ClickHouse DateTime is returned as a string "YYYY-MM-DD HH:MM:SS"
  // Convert to ISO format
  const killmailTime = new Date(killmail.killmailTime).toISOString()

  // Reconstruct ESI format
  return {
    killmail_id: killmail.killmailId,
    killmail_time: killmailTime,
    solar_system_id: killmail.solarSystemId,
    victim: {
      alliance_id: killmail.victimAllianceId,
      character_id: killmail.victimCharacterId,
      corporation_id: killmail.victimCorporationId,
      damage_taken: killmail.victimDamageTaken,
      ship_type_id: killmail.victimShipTypeId,
      position: {
        x: killmail.positionX,
        y: killmail.positionY,
        z: killmail.positionZ
      },
      items: items.map((item: any) => ({
        flag: item.flag,
        item_type_id: item.itemTypeId,
        quantity_dropped: item.quantityDropped || 0,
        quantity_destroyed: item.quantityDestroyed || 0,
        singleton: item.singleton
      }))
    },
    attackers: attackers.map((attacker: any) => ({
      alliance_id: attacker.allianceId,
      character_id: attacker.characterId,
      corporation_id: attacker.corporationId,
      damage_done: attacker.damageDone,
      final_blow: attacker.finalBlow === 1,
      security_status: attacker.securityStatus,
      ship_type_id: attacker.shipTypeId,
      weapon_type_id: attacker.weaponTypeId
    }))
  }
}

/**
 * Calculate MD5 hash of ESI killmail JSON (used for ESI endpoints)
 */
function calculateKillmailHash(esiData: ESIKillmail): string {
  const json = JSON.stringify(esiData)
  return createHash('md5').update(json).digest('hex')
}

/**
 * Store complete ESI killmail data with related records
 */
export async function storeKillmail(esiData: ESIKillmail, hash?: string): Promise<void> {
  try {
    const victim = esiData.victim
    const nowUnix = Math.floor(Date.now() / 1000)
    const version = Date.now()
    const killmailHash = hash || calculateKillmailHash(esiData)

    // Insert main killmail record
    const killmailRecord = {
      killmailId: esiData.killmail_id,
      killmailTime: esiData.killmail_time.replace('Z', '').replace('T', ' '), // Convert ISO to ClickHouse DateTime format
      solarSystemId: esiData.solar_system_id,

      // Victim information
      victimAllianceId: victim.alliance_id || null,
      victimCharacterId: victim.character_id || null,
      victimCorporationId: victim.corporation_id,
      victimDamageTaken: victim.damage_taken,
      victimShipTypeId: victim.ship_type_id,

      // Victim position
      positionX: victim.position?.x || null,
      positionY: victim.position?.y || null,
      positionZ: victim.position?.z || null,

      // ESI hash for API access
      hash: killmailHash,

      createdAt: nowUnix,
      version
    }

    // Insert killmail
    await database.insert('edk.killmails', killmailRecord)
    logger.info(`[Killmail] Stored killmail ${esiData.killmail_id} with hash ${killmailHash}`)

    // Insert attackers
    const attackerRecords = esiData.attackers.map((attacker) => ({
      killmailId: esiData.killmail_id,
      allianceId: attacker.alliance_id || null,
      corporationId: attacker.corporation_id || null,
      characterId: attacker.character_id || null,
      damageDone: attacker.damage_done,
      finalBlow: attacker.final_blow ? 1 : 0,
      securityStatus: attacker.security_status || null,
      shipTypeId: attacker.ship_type_id || null,
      weaponTypeId: attacker.weapon_type_id || null,
      createdAt: nowUnix,
      version
    }))

    if (attackerRecords.length > 0) {
      await database.bulkInsert('edk.attackers', attackerRecords)
    }

    // Insert items
    if (victim.items && victim.items.length > 0) {
      const itemRecords = victim.items.map((item) => ({
        killmailId: esiData.killmail_id,
        flag: item.flag,
        itemTypeId: item.item_type_id,
        quantityDropped: item.quantity_dropped || 0,
        quantityDestroyed: item.quantity_destroyed || 0,
        singleton: item.singleton,
        createdAt: nowUnix,
        version
      }))

      await database.bulkInsert('edk.items', itemRecords)
    }
  } catch (error) {
    logger.error(`[Killmail] Error storing killmail:`, { error })
    throw error
  }
}

/**
 * Store multiple ESI killmails with related records in bulk
 * More efficient than calling storeKillmail repeatedly
 */
export async function storeKillmailsBulk(esiDataArray: Array<{ esi: ESIKillmail; hash?: string }>): Promise<void> {
  if (esiDataArray.length === 0) return

  try {
    const nowUnix = Math.floor(Date.now() / 1000)
    const version = Date.now()

    // Prepare all killmail records
    const killmailRecords = esiDataArray.map(({ esi, hash }) => {
      const victim = esi.victim
      const killmailHash = hash || calculateKillmailHash(esi)
      return {
        killmailId: esi.killmail_id,
        killmailTime: esi.killmail_time.replace('Z', '').replace('T', ' '),
        solarSystemId: esi.solar_system_id,
        victimAllianceId: victim.alliance_id || null,
        victimCharacterId: victim.character_id || null,
        victimCorporationId: victim.corporation_id,
        victimDamageTaken: victim.damage_taken,
        victimShipTypeId: victim.ship_type_id,
        positionX: victim.position?.x || null,
        positionY: victim.position?.y || null,
        positionZ: victim.position?.z || null,
        hash: killmailHash,
        createdAt: nowUnix,
        version
      }
    })

    // Insert all killmails at once
    await database.bulkInsert('edk.killmails', killmailRecords)
    logger.info(`[Killmail] Stored ${killmailRecords.length} killmails in bulk`)

    // Prepare all attacker records
    const allAttackerRecords = esiDataArray.flatMap(({ esi }) =>
      esi.attackers.map(attacker => ({
        killmailId: esi.killmail_id,
        allianceId: attacker.alliance_id || null,
        corporationId: attacker.corporation_id || null,
        characterId: attacker.character_id || null,
        damageDone: attacker.damage_done,
        finalBlow: attacker.final_blow ? 1 : 0,
        securityStatus: attacker.security_status || null,
        shipTypeId: attacker.ship_type_id || null,
        weaponTypeId: attacker.weapon_type_id || null,
        createdAt: nowUnix,
        version
      }))
    )

    // Insert all attackers at once
    if (allAttackerRecords.length > 0) {
      await database.bulkInsert('edk.attackers', allAttackerRecords)
      logger.info(`[Killmail] Stored ${allAttackerRecords.length} attackers in bulk`)
    }

    // Prepare all item records
    const allItemRecords = esiDataArray.flatMap(({ esi }) => {
      const victim = esi.victim
      if (!victim.items || victim.items.length === 0) return []

      return victim.items.map(item => ({
        killmailId: esi.killmail_id,
        flag: item.flag,
        itemTypeId: item.item_type_id,
        quantityDropped: item.quantity_dropped || 0,
        quantityDestroyed: item.quantity_destroyed || 0,
        singleton: item.singleton,
        createdAt: nowUnix,
        version
      }))
    })

    // Insert all items at once
    if (allItemRecords.length > 0) {
      await database.bulkInsert('edk.items', allItemRecords)
      logger.info(`[Killmail] Stored ${allItemRecords.length} items in bulk`)
    }
  } catch (error) {
    logger.error(`[Killmail] Error storing killmails in bulk:`, { error })
    throw error
  }
}
