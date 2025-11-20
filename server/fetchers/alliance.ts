import { fetchEveKill, fetchESI } from '../helpers/fetcher'
import { storeAlliance as storeAllianceInDB, getAlliance } from '../models/alliances'

/**
 * ESI Alliance Data - Fields we store
 * Only contains fields from the official ESI API
 */
export interface ESIAlliance {
  creator_corporation_id: number
  creator_id: number
  date_founded: string
  executor_corporation_id: number
  name: string
  ticker: string
}

/**
 * Fetch alliance data from EVE-KILL with fallback to ESI
 * Stores only ESI-compatible fields in the database
 */
export async function fetchAndStoreAlliance(allianceId: number): Promise<ESIAlliance | null> {
  try {
    // Try EVE-KILL first
    let allianceData = await fetchFromEveKill(allianceId)

    // Fallback to ESI if EVE-KILL fails
    if (!allianceData) {
      console.log(`⚠️  EVE-KILL failed for alliance ${allianceId}, falling back to ESI`)
      allianceData = await fetchFromESI(allianceId)
    }

    if (!allianceData) {
      console.error(`❌ Failed to fetch alliance ${allianceId} from both sources`)
      return null
    }

    // Extract only ESI fields
    const esiAlliance = extractESIFields(allianceData)

    // Store in database
    await storeAlliance(allianceId, esiAlliance)

    return esiAlliance
  } catch (error) {
    console.error(`❌ Error fetching alliance ${allianceId}:`, error)
    return null
  }
}

/**
 * Fetch alliance data from EVE-KILL API
 */
async function fetchFromEveKill(allianceId: number): Promise<any | null> {
  try {
    const response = await fetchEveKill(`/alliances/${allianceId}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`EVE-KILL API error: ${response.statusText}`)
    }

    return response.data
  } catch (error) {
    console.warn(`⚠️  EVE-KILL fetch failed for alliance ${allianceId}:`, error)
    return null
  }
}

/**
 * Fetch alliance data from ESI API
 */
async function fetchFromESI(allianceId: number): Promise<any | null> {
  try {
    const response = await fetchESI(`/alliances/${allianceId}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`ESI API error: ${response.statusText}`)
    }

    return response.data
  } catch (error) {
    console.warn(`⚠️  ESI fetch failed for alliance ${allianceId}:`, error)
    return null
  }
}

/**
 * Extract only ESI-compatible fields from alliance data
 */
function extractESIFields(data: any): ESIAlliance {
  return {
    creator_corporation_id: data.creator_corporation_id,
    creator_id: data.creator_id,
    date_founded: data.date_founded,
    executor_corporation_id: data.executor_corporation_id,
    name: data.name,
    ticker: data.ticker
  }
}

/**
 * Store alliance in database
 */
async function storeAlliance(allianceId: number, alliance: ESIAlliance): Promise<void> {
  await storeAllianceInDB(allianceId, {
    creatorCorporationId: alliance.creator_corporation_id,
    creatorId: alliance.creator_id,
    dateFounded: alliance.date_founded,
    executorCorporationId: alliance.executor_corporation_id,
    name: alliance.name,
    ticker: alliance.ticker
  })
}

/**
 * Get cached alliance from database
 */
export async function getCachedAlliance(allianceId: number): Promise<ESIAlliance | null> {
  try {
    const result = await getAlliance(allianceId)

    if (!result) {
      return null
    }

    return {
      creator_corporation_id: result.creatorCorporationId,
      creator_id: result.creatorId,
      date_founded: result.dateFounded,
      executor_corporation_id: result.executorCorporationId,
      name: result.name,
      ticker: result.ticker
    }
  } catch (error) {
    console.warn(`⚠️  Failed to get cached alliance ${allianceId}:`, error)
    return null
  }
}
