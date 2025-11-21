import { fetchESI } from '../helpers/esi'
import { storeCorporation as storeCorporationInDB, getCorporation } from '../models/corporations'
import { getNPCCorporation } from '../models/npcCorporations'

/**
 * ESI Corporation Data - Fields we store
 * Only contains fields from the official ESI API
 */
export interface ESICorporation {
  alliance_id: number | null
  ceo_id: number
  creator_id: number
  date_founded: string
  description: string
  home_station_id: number | null
  member_count: number
  name: string
  shares: number
  tax_rate: number
  ticker: string
  url: string
}

/**
 * Fetch corporation data from ESI or SDE
 * For NPC corporations (ID < 2000000), check SDE first
 * Stores only ESI-compatible fields in the database
 */
export async function fetchAndStoreCorporation(corporationId: number): Promise<ESICorporation | null> {
  try {
    // Check if this is an NPC corporation (ID range: 1,000,000 - 1,999,999)
    // See: https://developers.eveonline.com/docs/guides/id-ranges/
    if (corporationId >= 1000000 && corporationId <= 1999999) {
      const npcCorp = await getNPCCorporation(corporationId)
      if (npcCorp) {
        // Convert NPC corporation to ESI format and store
        const esiCorporation: ESICorporation = {
          alliance_id: null, // NPC corps don't have alliances
          ceo_id: npcCorp.ceoId ?? 1,
          creator_id: 1, // Default for NPC corps
          date_founded: '2003-05-06T00:00:00Z', // EVE launch date
          description: npcCorp.description ?? '',
          home_station_id: npcCorp.stationId ?? null,
          member_count: 0, // NPC corps don't track members
          name: npcCorp.name,
          shares: 0,
          tax_rate: npcCorp.taxRate ?? 0,
          ticker: npcCorp.tickerName ?? '',
          url: ''
        }

        // Store in corporations table for consistency
        await storeCorporation(corporationId, esiCorporation)
        return esiCorporation
      }
    }

    // Not an NPC corp or not found in SDE, fetch from ESI
    const corporationData = await fetchFromESI(corporationId)

    if (!corporationData) {
      return null
    }

    // Extract only ESI fields
    const esiCorporation = extractESIFields(corporationData)

    // Store in database
    await storeCorporation(corporationId, esiCorporation)

    return esiCorporation
  } catch (error) {
    console.error(`Failed to fetch corporation ${corporationId}:`, error)
    return null
  }
}

/**
 * Fetch corporation data from ESI API
 */
async function fetchFromESI(corporationId: number): Promise<any | null> {
  try {
    const response = await fetchESI(`/corporations/${corporationId}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`ESI API error: ${response.statusText}`)
    }

    return response.data
  } catch (error) {
    console.error(`ESI fetch failed for corporation ${corporationId}:`, error)
    return null
  }
}

/**
 * Extract only ESI-compatible fields from corporation data
 */
function extractESIFields(data: any): ESICorporation {
  return {
    alliance_id: data.alliance_id ?? null,
    ceo_id: data.ceo_id ?? 1, // Default to 1 for NPC corps
    creator_id: data.creator_id ?? 1, // Default to 1 for NPC corps
    date_founded: data.date_founded ?? '2003-05-06T00:00:00Z', // EVE launch date
    description: data.description ?? '',
    home_station_id: data.home_station_id ?? null,
    member_count: data.member_count ?? 0,
    name: data.name,
    shares: data.shares ?? 0,
    tax_rate: data.tax_rate ?? 0,
    ticker: data.ticker,
    url: data.url ?? ''
  }
}

/**
 * Store corporation in database
 */
async function storeCorporation(corporationId: number, corporation: ESICorporation): Promise<void> {
  await storeCorporationInDB(corporationId, {
    allianceId: corporation.alliance_id,
    ceoId: corporation.ceo_id,
    creatorId: corporation.creator_id,
    dateFounded: corporation.date_founded,
    description: corporation.description,
    homeStationId: corporation.home_station_id,
    memberCount: corporation.member_count,
    name: corporation.name,
    shares: corporation.shares,
    taxRate: corporation.tax_rate,
    ticker: corporation.ticker,
    url: corporation.url
  })
}

/**
 * Get cached corporation from database
 */
export async function getCachedCorporation(corporationId: number): Promise<ESICorporation | null> {
  try {
    const result = await getCorporation(corporationId)

    if (!result) {
      return null
    }

    return {
      alliance_id: result.allianceId,
      ceo_id: result.ceoId,
      creator_id: result.creatorId,
      date_founded: result.dateFounded,
      description: result.description,
      home_station_id: result.homeStationId,
      member_count: result.memberCount,
      name: result.name,
      shares: result.shares,
      tax_rate: result.taxRate,
      ticker: result.ticker,
      url: result.url
    }
  } catch (error) {
    return null
  }
}
