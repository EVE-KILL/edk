import { fetchESI } from '../helpers/esi'
import { storeKillmail, type ESIKillmail } from '../models/killmails'
import { logger } from '../helpers/logger'

export interface ExtractedEntities {
  characterIds: number[]
  corporationIds: number[]
  allianceIds: number[]
  typeIds: number[] // For price fetching
  killmailTime: string // ISO 8601 timestamp from killmail
}

/**
 * Fetch complete killmail from ESI and store it
 * Returns extracted entity IDs for queue processing
 */
export async function fetchAndStoreKillmail(killmailId: number, hash: string): Promise<ExtractedEntities | null> {
  try {
    // Fetch from ESI
    const response = await fetchESI<ESIKillmail>(`/killmails/${killmailId}/${hash}/`)

    if (!response.data) {
      logger.error(`[Killmail] Failed to fetch killmail ${killmailId}`)
      return null
    }

    // Store the killmail
    await storeKillmail(response.data)

    // Extract entity IDs for queue processing
    const esiData = response.data
    const victim = esiData.victim

    const characterIds = new Set<number>()
    const corporationIds = new Set<number>()
    const allianceIds = new Set<number>()
    const typeIds = new Set<number>()

    // Add victim
    if (victim.character_id) characterIds.add(victim.character_id)
    if (victim.corporation_id) corporationIds.add(victim.corporation_id)
    if (victim.alliance_id) allianceIds.add(victim.alliance_id)

    // Add victim ship type
    typeIds.add(victim.ship_type_id)

    // Add attackers
    for (const attacker of esiData.attackers) {
      if (attacker.character_id) characterIds.add(attacker.character_id)
      if (attacker.corporation_id) corporationIds.add(attacker.corporation_id)
      if (attacker.alliance_id) allianceIds.add(attacker.alliance_id)

      // Add attacker ship types
      if (attacker.ship_type_id) typeIds.add(attacker.ship_type_id)
    }

    // Add item types from victim items
    if (victim.items) {
      for (const item of victim.items) {
        typeIds.add(item.item_type_id)
      }
    }

    return {
      characterIds: Array.from(characterIds),
      corporationIds: Array.from(corporationIds),
      allianceIds: Array.from(allianceIds),
      typeIds: Array.from(typeIds),
      killmailTime: esiData.killmail_time
    }
  } catch (error) {
    logger.error(`[Killmail] Error processing killmail ${killmailId}:`, { error })
    return null
  }
}

