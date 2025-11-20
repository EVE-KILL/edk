import { database } from '../helpers/database'

/**
 * Corporation Model
 *
 * Queries the corporations table (player corporations from ESI)
 * Uses ReplacingMergeTree with version field for updates
 */

export interface Corporation {
  corporationId: number
  allianceId: number | null
  ceoId: number
  creatorId: number
  dateFounded: string
  description: string
  homeStationId: number | null
  memberCount: number
  name: string
  shares: number
  taxRate: number
  ticker: string
  url: string
  updatedAt: Date
  version: number
}

/**
 * Get corporation by ID
 */
export async function getCorporation(corporationId: number): Promise<Corporation | null> {
  return await database.queryOne<Corporation>(
    'SELECT * FROM corporations FINAL WHERE corporationId = {id:UInt32}',
    { id: corporationId }
  )
}

/**
 * Get multiple corporations by IDs
 */
export async function getCorporations(corporationIds: number[]): Promise<Corporation[]> {
  if (corporationIds.length === 0) return []

  return await database.query<Corporation>(
    'SELECT * FROM corporations FINAL WHERE corporationId IN ({ids:Array(UInt32)})',
    { ids: corporationIds }
  )
}

/**
 * Search corporations by name
 */
export async function searchCorporations(searchTerm: string, limit: number = 20): Promise<Corporation[]> {
  return await database.query<Corporation>(
    `SELECT * FROM corporations FINAL
     WHERE name ILIKE {search:String}
     ORDER BY name
     LIMIT {limit:UInt32}`,
    { search: `%${searchTerm}%`, limit }
  )
}

/**
 * Get corporation name by ID
 */
export async function getCorporationName(corporationId: number): Promise<string | null> {
  const name = await database.queryValue<string>(
    'SELECT name FROM corporations FINAL WHERE corporationId = {id:UInt32}',
    { id: corporationId }
  )
  return name || null
}

/**
 * Get corporation ticker by ID
 */
export async function getCorporationTicker(corporationId: number): Promise<string | null> {
  const ticker = await database.queryValue<string>(
    'SELECT ticker FROM corporations FINAL WHERE corporationId = {id:UInt32}',
    { id: corporationId }
  )
  return ticker || null
}

/**
 * Get corporations by alliance
 */
export async function getCorporationsByAlliance(allianceId: number): Promise<Corporation[]> {
  return await database.query<Corporation>(
    'SELECT * FROM corporations FINAL WHERE allianceId = {allianceId:UInt32}',
    { allianceId }
  )
}

/**
 * Get corporations by CEO
 */
export async function getCorporationsByCEO(characterId: number): Promise<Corporation[]> {
  return await database.query<Corporation>(
    'SELECT * FROM corporations FINAL WHERE ceoId = {charId:UInt32}',
    { charId: characterId }
  )
}

/**
 * Get corporations by creator
 */
export async function getCorporationsByCreator(characterId: number): Promise<Corporation[]> {
  return await database.query<Corporation>(
    'SELECT * FROM corporations FINAL WHERE creatorId = {charId:UInt32}',
    { charId: characterId }
  )
}

/**
 * Count total corporations
 */
export async function countCorporations(): Promise<number> {
  return await database.count('corporations', '')
}

/**
 * Count corporations in an alliance
 */
export async function countCorporationsInAlliance(allianceId: number): Promise<number> {
  return await database.count('corporations', 'allianceId = {allianceId:UInt32}', { allianceId })
}

/**
 * Store or update corporation data
 */
export async function storeCorporation(
  corporationId: number,
  data: {
    allianceId: number | null
    ceoId: number
    creatorId: number
    dateFounded: string
    description: string
    homeStationId: number | null
    memberCount: number
    name: string
    shares: number
    taxRate: number
    ticker: string
    url: string
  }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  await database.bulkInsert('corporations', [
    {
      corporationId: corporationId,
      allianceId: data.allianceId,
      ceoId: data.ceoId,
      creatorId: data.creatorId,
      date_founded: data.dateFounded,
      description: data.description,
      home_station_id: data.homeStationId,
      member_count: data.memberCount,
      name: data.name,
      shares: data.shares,
      tax_rate: data.taxRate,
      ticker: data.ticker,
      url: data.url,
      updated_at: now,
      version: now
    }
  ])
}

/**
 * Bulk store corporation data (for backfill/import)
 */
export async function storeCorporationsBulk(
  corporations: Array<{
    corporationId: number
    allianceId: number | null
    ceoId: number
    creatorId: number
    dateFounded: string
    description: string
    homeStationId: number | null
    memberCount: number
    name: string
    shares: number
    taxRate: number
    ticker: string
    url: string
  }>
): Promise<void> {
  if (corporations.length === 0) return

  const now = Math.floor(Date.now() / 1000)

  const records = corporations.map(corp => ({
    corporationId: corp.corporationId,
    allianceId: corp.allianceId,
    ceoId: corp.ceoId,
    creatorId: corp.creatorId,
    dateFounded: corp.dateFounded,
    description: corp.description,
    homeStationId: corp.homeStationId,
    memberCount: corp.memberCount,
    name: corp.name,
    shares: corp.shares,
    taxRate: corp.taxRate,
    ticker: corp.ticker,
    url: corp.url,
    updatedAt: now,
    version: now
  }))

  await database.bulkInsert('corporations', records)
}

/**
 * Check if corporation exists
 */
export async function corporationExists(corporationId: number): Promise<boolean> {
  const count = await database.count('corporations', 'corporationId = {id:UInt32}', { id: corporationId })
  return count > 0
}

/**
 * Get corporation with alliance information
 */
export async function getCorporationWithAlliance(corporationId: number): Promise<{
  name: string
  ticker: string
  allianceId: number | null
  allianceName: string | null
  allianceTicker: string | null
} | null> {
  return await database.queryOne<{
    name: string
    ticker: string
    allianceId: number | null
    allianceName: string | null
    allianceTicker: string | null
  }>(
    `SELECT
      c.name as name,
      c.ticker as ticker,
      c.allianceId as allianceId,
      alliance.name as allianceName,
      alliance.ticker as allianceTicker
    FROM corporations c
    FINAL
    LEFT JOIN alliances alliance FINAL ON c.allianceId = alliance.allianceId
    WHERE c.corporationId = {corporationId:UInt32}
    LIMIT 1`,
    { corporationId }
  )
}
