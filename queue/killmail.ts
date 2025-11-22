import { Worker, Job } from 'bullmq'
import { fetchESI as defaultFetchESI } from '../server/helpers/esi'
import { storeKillmail as defaultStoreKillmail, type ESIKillmail } from '../server/models/killmails'
import { fetchAndStoreCharacter as defaultFetchAndStoreCharacter } from '../server/fetchers/character'
import { fetchAndStoreCorporation as defaultFetchAndStoreCorporation } from '../server/fetchers/corporation'
import { fetchAndStoreAlliance as defaultFetchAndStoreAlliance } from '../server/fetchers/alliance'
import { fetchPrices as defaultFetchPrices } from '../server/fetchers/price'
import { storePrices as defaultStorePrices } from '../server/models/prices'

export const name = 'killmail'

interface KillmailJobData {
  killmailId: number
  hash: string
}

interface KillmailProcessorDependencies {
  fetchESI: typeof defaultFetchESI,
  storeKillmail: typeof defaultStoreKillmail,
  fetchAndStoreCharacter: typeof defaultFetchAndStoreCharacter,
  fetchAndStoreCorporation: typeof defaultFetchAndStoreCorporation,
  fetchAndStoreAlliance: typeof defaultFetchAndStoreAlliance,
  fetchPrices: typeof defaultFetchPrices,
  storePrices: typeof defaultStorePrices
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
export async function processor(
  job: Job<KillmailJobData>,
  dependencies: KillmailProcessorDependencies = {
    fetchESI: defaultFetchESI,
    storeKillmail: defaultStoreKillmail,
    fetchAndStoreCharacter: defaultFetchAndStoreCharacter,
    fetchAndStoreCorporation: defaultFetchAndStoreCorporation,
    fetchAndStoreAlliance: defaultFetchAndStoreAlliance,
    fetchPrices: defaultFetchPrices,
    storePrices: defaultStorePrices
  }
): Promise<void> {
  const { killmailId, hash } = job.data
  const {
    fetchESI,
    storeKillmail,
    fetchAndStoreCharacter,
    fetchAndStoreCorporation,
    fetchAndStoreAlliance,
    fetchPrices,
    storePrices
  } = dependencies

  console.log(`[killmail] Processing killmail ${killmailId}...`)

  try {
    // Step 1: Fetch killmail from ESI
    const response = await fetchESI<ESIKillmail>(`/killmails/${killmailId}/${hash}/`)
    if (!response.ok || !response.data || !response.data.victim) {
      console.warn(`⚠️  [killmail] Killmail ${killmailId} not found or invalid (status: ${response.status})`)
      return
    }

    const killmail = response.data

    // Step 2: Extract all entity IDs and type IDs
    const victim = killmail.victim
    const characterIds = new Set<number>()
    const corporationIds = new Set<number>()
    const allianceIds = new Set<number>()
    const typeIds = new Set<number>()

    // Add victim
    if (victim.character_id) characterIds.add(victim.character_id)
    if (victim.corporation_id) corporationIds.add(victim.corporation_id)
    if (victim.alliance_id) allianceIds.add(victim.alliance_id)
    typeIds.add(victim.ship_type_id)

    // Add attackers
    for (const attacker of killmail.attackers) {
      if (attacker.character_id) characterIds.add(attacker.character_id)
      if (attacker.corporation_id) corporationIds.add(attacker.corporation_id)
      if (attacker.alliance_id) allianceIds.add(attacker.alliance_id)
      if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id)
    }

    // Add item types
    if (victim.items) {
      for (const item of victim.items) {
        typeIds.add(item.item_type_id)
      }
    }

    console.log(`[killmail] ${killmailId}: Extracted ${characterIds.size} characters, ${corporationIds.size} corporations, ${allianceIds.size} alliances, ${typeIds.size} types`)

    // Step 3: Fetch all entity data in parallel
    console.log(`[killmail] ${killmailId}: Fetching entity data...`)
    await Promise.all([
      // Characters
      ...Array.from(characterIds).map(id =>
        fetchAndStoreCharacter(id).catch(err => {
          console.warn(`⚠️  [killmail] ${killmailId}: Failed to fetch character ${id}:`, err.message)
        })
      ),

      // Corporations
      ...Array.from(corporationIds).map(id =>
        fetchAndStoreCorporation(id).catch(err => {
          console.warn(`⚠️  [killmail] ${killmailId}: Failed to fetch corporation ${id}:`, err.message)
        })
      ),

      // Alliances
      ...Array.from(allianceIds).map(id =>
        fetchAndStoreAlliance(id).catch(err => {
          console.warn(`⚠️  [killmail] ${killmailId}: Failed to fetch alliance ${id}:`, err.message)
        })
      )
    ])

    // Step 4: Fetch price data for all type IDs
    const killmailDate = new Date(killmail.killmail_time)
    const unixTimestamp = Math.floor(killmailDate.getTime() / 1000)
    console.log(`[killmail] ${killmailId}: Fetching prices for ${typeIds.size} types...`)

    // Fetch prices for each type
    for (const typeId of typeIds) {
      try {
        const prices = await fetchPrices(typeId, 14, unixTimestamp)
        if (prices.length > 0) {
          await storePrices(prices)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.warn(`⚠️  [killmail] ${killmailId}: Failed to fetch prices for type ${typeId}:`, errorMsg)
        // Continue with other types
      }
    }

    // Step 5: Store the killmail
    // At this point, all entity and price data should be in the database
    // The materialized view will populate with complete data
    console.log(`[killmail] ${killmailId}: Storing killmail...`)
    await storeKillmail(killmail, hash)

    console.log(`✅ [killmail] Successfully processed killmail ${killmailId}`)
  } catch (error) {
    console.error(`❌ [killmail] Error processing killmail ${killmailId}:`, error)
    throw error // Re-throw to trigger retry
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
