import { database } from '../helpers/database'

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

const ESI_BASE_URL = 'https://esi.evetech.net/latest'
const EVEKILL_BASE_URL = 'https://eve-kill.com/api'

/**
 * Fetch corporation data from EVE-KILL with fallback to ESI
 * Stores only ESI-compatible fields in the database
 */
export async function fetchAndStoreCorporation(corporationId: number): Promise<ESICorporation | null> {
  try {
    // Try EVE-KILL first
    let corporationData = await fetchFromEveKill(corporationId)

    // Fallback to ESI if EVE-KILL fails
    if (!corporationData) {
      console.log(`⚠️  EVE-KILL failed for corporation ${corporationId}, falling back to ESI`)
      corporationData = await fetchFromESI(corporationId)
    }

    if (!corporationData) {
      console.error(`❌ Failed to fetch corporation ${corporationId} from both sources`)
      return null
    }

    // Extract only ESI fields
    const esiCorporation = extractESIFields(corporationData)

    // Store in database
    await storeCorporation(corporationId, esiCorporation)

    return esiCorporation
  } catch (error) {
    console.error(`❌ Error fetching corporation ${corporationId}:`, error)
    return null
  }
}

/**
 * Fetch corporation data from EVE-KILL API
 */
async function fetchFromEveKill(corporationId: number): Promise<any | null> {
  try {
    const response = await fetch(`${EVEKILL_BASE_URL}/corporations/${corporationId}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`EVE-KILL API error: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.warn(`⚠️  EVE-KILL fetch failed for corporation ${corporationId}:`, error)
    return null
  }
}

/**
 * Fetch corporation data from ESI API
 */
async function fetchFromESI(corporationId: number): Promise<any | null> {
  try {
    const response = await fetch(`${ESI_BASE_URL}/corporations/${corporationId}`)

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`ESI API error: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.warn(`⚠️  ESI fetch failed for corporation ${corporationId}:`, error)
    return null
  }
}

/**
 * Extract only ESI-compatible fields from corporation data
 */
function extractESIFields(data: any): ESICorporation {
  return {
    alliance_id: data.alliance_id || null,
    ceo_id: data.ceo_id,
    creator_id: data.creator_id,
    date_founded: data.date_founded,
    description: data.description || '',
    home_station_id: data.home_station_id || null,
    member_count: data.member_count || 0,
    name: data.name,
    shares: data.shares || 0,
    tax_rate: data.tax_rate || 0,
    ticker: data.ticker,
    url: data.url || ''
  }
}

/**
 * Store corporation in database
 */
async function storeCorporation(corporationId: number, corporation: ESICorporation): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  await database.bulkInsert('edk.corporations', [
    {
      corporation_id: corporationId,
      alliance_id: corporation.alliance_id,
      ceo_id: corporation.ceo_id,
      creator_id: corporation.creator_id,
      date_founded: corporation.date_founded,
      description: corporation.description,
      home_station_id: corporation.home_station_id,
      member_count: corporation.member_count,
      name: corporation.name,
      shares: corporation.shares,
      tax_rate: corporation.tax_rate,
      ticker: corporation.ticker,
      url: corporation.url,
      updated_at: now,
      version: now
    }
  ])
}

/**
 * Get cached corporation from database
 */
export async function getCachedCorporation(corporationId: number): Promise<ESICorporation | null> {
  try {
    const result = await database.queryOne<any>(
      'SELECT * FROM edk.corporations WHERE corporation_id = {id:UInt32}',
      { id: corporationId }
    )

    if (!result) {
      return null
    }

    return {
      alliance_id: result.alliance_id,
      ceo_id: result.ceo_id,
      creator_id: result.creator_id,
      date_founded: result.date_founded,
      description: result.description,
      home_station_id: result.home_station_id,
      member_count: result.member_count,
      name: result.name,
      shares: result.shares,
      tax_rate: result.tax_rate,
      ticker: result.ticker,
      url: result.url
    }
  } catch (error) {
    console.warn(`⚠️  Failed to get cached corporation ${corporationId}:`, error)
    return null
  }
}
