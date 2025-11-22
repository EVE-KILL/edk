import { Worker, Job } from 'bullmq'

import { createRedisClient } from '../server/helpers/redis'
import { fetchESI } from '../server/helpers/esi'
import { storeKillmail, calculateKillmailValues, type ESIKillmail } from '../server/models/killmails'
import { fetchAndStoreCharacter, type ESICharacter } from '../server/fetchers/character'
import { fetchAndStoreCorporation, type ESICorporation } from '../server/fetchers/corporation'
import { fetchAndStoreAlliance, type ESIAlliance } from '../server/fetchers/alliance'
import { fetchPrices } from '../server/fetchers/price'
import { storePrices } from '../server/models/prices'
import { database } from '../server/helpers/database'
import { normalizeKillRow } from '../server/helpers/templates'
import type { EntityKillmail } from '../server/models/killlist'

const redis = createRedisClient()

export const name = 'killmail'

interface KillmailJobData {
  killmailId: number
  hash: string
}

/**
 * Killmail Queue Processor
 *
 * This processor handles the complete killmail ingestion flow:
 * 1. Fetch killmail from ESI
 * 2. Extract all entity IDs (characters, corporations, alliances, types)
 * 3. Ensure all entity data exists in database (fetch if needed)
 * 4. Ensure all price data exists in database (fetch if needed)
 * 5. Store the killmail (materialized view will have complete data)
 *
 * This approach ensures that when a killmail is stored, all referenced
 * entities and prices are already in the database, allowing the materialized
 * view to be fully populated with names and values.
 */
export async function processor(job: Job<KillmailJobData>): Promise<void> {
  const { killmailId, hash } = job.data

  console.log(`[killmail] Processing killmail ${killmailId}...`)

  try {
    const response = await fetchESI<ESIKillmail>(`/killmails/${killmailId}/${hash}/`)
    if (!response.ok || !response.data || !response.data.victim) {
      console.warn(`⚠️  [killmail] Killmail ${killmailId} not found or invalid (status: ${response.status})`)
      return
    }

    const killmail = response.data
    const victim = killmail.victim

    // In-memory caches for entities
    const characterCache = new Map<number, ESICharacter | null>()
    const corporationCache = new Map<number, ESICorporation | null>()
    const allianceCache = new Map<number, ESIAlliance | null>()

    // Collect all unique IDs
    const characterIds = new Set<number>()
    const corporationIds = new Set<number>()
    const allianceIds = new Set<number>()
    const typeIds = new Set<number>()

    if (victim.character_id) characterIds.add(victim.character_id)
    if (victim.corporation_id) corporationIds.add(victim.corporation_id)
    if (victim.alliance_id) allianceIds.add(victim.alliance_id)
    typeIds.add(victim.ship_type_id)

    for (const attacker of killmail.attackers) {
      if (attacker.character_id) characterIds.add(attacker.character_id)
      if (attacker.corporation_id) corporationIds.add(attacker.corporation_id)
      if (attacker.alliance_id) allianceIds.add(attacker.alliance_id)
      if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id)
    }

    if (victim.items) {
      for (const item of victim.items) {
        typeIds.add(item.item_type_id)
      }
    }

    // Fetch all entities in parallel and populate caches
    await Promise.all([
      ...Array.from(characterIds).map(async id => {
        const char = await fetchAndStoreCharacter(id)
        characterCache.set(id, char)
      }),
      ...Array.from(corporationIds).map(async id => {
        const corp = await fetchAndStoreCorporation(id)
        corporationCache.set(id, corp)
      }),
      ...Array.from(allianceIds).map(async id => {
        const ally = await fetchAndStoreAlliance(id)
        allianceCache.set(id, ally)
      })
    ])

    // Fetch price data
    const killmailDate = new Date(killmail.killmail_time)
    const unixTimestamp = Math.floor(killmailDate.getTime() / 1000)
    for (const typeId of typeIds) {
      try {
        const prices = await fetchPrices(typeId, 14, unixTimestamp)
        if (prices.length > 0) {
          await storePrices(prices)
        }
      } catch (err) {
        // Log and continue
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.warn(`⚠️  [killmail] ${killmailId}: Failed to fetch prices for type ${typeId}:`, errorMsg)
      }
    }

    // Store killmail
    await storeKillmail(killmail, hash)

    // Assemble EntityKillmail in memory
    // Find top attacker (final blow or highest damage)
    const finalBlowAttacker = killmail.attackers.find((a) => a.final_blow)
    const topAttacker = finalBlowAttacker || killmail.attackers.reduce(
      (max, a) => (a.damage_done > max.damage_done ? a : max),
      killmail.attackers[0]
    )

    const [
      victimShip,
      solarSystem,
      region
    ] = await Promise.all([
      database.sql`SELECT name, "groupId" FROM types WHERE "typeId" = ${victim.ship_type_id}`.then(([row]) => row),
      database.sql`SELECT name, "regionId" FROM solarSystems WHERE "solarSystemId" = ${killmail.solar_system_id}`.then(([row]) => row),
      database.sql`SELECT name FROM regions WHERE "regionId" = (SELECT "regionId" FROM solarSystems WHERE "solarSystemId" = ${killmail.solar_system_id})`.then(([row]) => row)
    ])
    const victimShipGroup = victimShip ? await database.sql`SELECT name FROM groups WHERE "groupId" = ${victimShip.groupId}`.then(([row]) => row) : null

    const victimCharacter = victim.character_id ? characterCache.get(victim.character_id) : null
    const victimCorporation = victim.corporation_id ? corporationCache.get(victim.corporation_id) : null
    const victimAlliance = victim.alliance_id ? allianceCache.get(victim.alliance_id) : null

    const attackerCharacter = topAttacker?.character_id ? characterCache.get(topAttacker.character_id) : null
    const attackerCorporation = topAttacker?.corporation_id ? corporationCache.get(topAttacker.corporation_id) : null
    const attackerAlliance = topAttacker?.alliance_id ? allianceCache.get(topAttacker.alliance_id) : null

    // Calculate total value
    const valueBreakdown = await calculateKillmailValues(killmail)

    const entityKillmail: EntityKillmail = {
      killmailId: killmail.killmail_id,
      killmailTime: killmail.killmail_time,
      victimCharacterId: victim.character_id || null,
      victimCharacterName: victimCharacter?.name || 'Unknown',
      victimCorporationId: victim.corporation_id,
      victimCorporationName: victimCorporation?.name || 'Unknown',
      victimCorporationTicker: victimCorporation?.ticker || '???',
      victimAllianceId: victim.alliance_id || null,
      victimAllianceName: victimAlliance?.name || null,
      victimAllianceTicker: victimAlliance?.ticker || null,
      victimShipTypeId: victim.ship_type_id,
      victimShipName: victimShip?.name || 'Unknown',
      victimShipGroup: victimShipGroup?.name || 'Unknown',
      victimShipGroupId: victimShip?.groupId || 0,
      attackerCharacterId: topAttacker?.character_id || null,
      attackerCharacterName: attackerCharacter?.name || 'Unknown',
      attackerCorporationId: topAttacker?.corporation_id || null,
      attackerCorporationName: attackerCorporation?.name || 'Unknown',
      attackerCorporationTicker: attackerCorporation?.ticker || '???',
      attackerAllianceId: topAttacker?.alliance_id || null,
      attackerAllianceName: attackerAlliance?.name || null,
      attackerAllianceTicker: attackerAlliance?.ticker || null,
      attackerShipTypeId: topAttacker?.ship_type_id || null,
      attackerShipName: null,
      solarSystemId: killmail.solar_system_id,
      regionId: solarSystem?.regionId || 0,
      security: 0,
      solarSystemName: solarSystem?.name || 'Unknown',
      regionName: region?.name || 'Unknown',
      totalValue: valueBreakdown?.totalValue || 0,
      attackerCount: killmail.attackers.length,
      npc: killmail.attackers.every((a) => !a.character_id),
      solo: killmail.attackers.length === 1,
      awox: !!(victim.alliance_id && victim.alliance_id > 0 && killmail.attackers.some((a) => a.alliance_id === victim.alliance_id))
    }

    // Normalize and broadcast
    const normalized = normalizeKillRow(entityKillmail)
    await redis.publish('killmails', JSON.stringify({ normalizedKillmail: normalized }))

    console.log(`✅ [killmail] Successfully processed and broadcasted killmail ${killmailId}`)
  } catch (error) {
    console.error(`❌ [killmail] Error processing killmail ${killmailId}:`, error)
    throw error
  }
}

/**
 * Create worker instance
 * Used by main queue.ts runner
 */
export function createWorker(connection: any, options?: { concurrency?: number }) {
  return new Worker(name, processor, {
    connection,
    concurrency: options?.concurrency ?? 3, // Process 3 killmails concurrently by default
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000 // Per second
    }
  })
}
