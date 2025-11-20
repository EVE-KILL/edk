import { database } from '../helpers/database'

/**
 * Alliance Model
 *
 * Queries the alliances table (player alliances from ESI)
 * Uses ReplacingMergeTree with version field for updates
 */

export interface Alliance {
  allianceId: number
  creatorCorporationId: number
  creatorId: number
  dateFounded: string
  executorCorporationId: number
  name: string
  ticker: string
  updatedAt: Date
  version: number
}

/**
 * Get alliance by ID
 */
export async function getAlliance(allianceId: number): Promise<Alliance | null> {
  return await database.queryOne<Alliance>(
    'SELECT * FROM alliances FINAL WHERE allianceId = {id:UInt32}',
    { id: allianceId }
  )
}

/**
 * Get multiple alliances by IDs
 */
export async function getAlliances(allianceIds: number[]): Promise<Alliance[]> {
  if (allianceIds.length === 0) return []

  return await database.query<Alliance>(
    'SELECT * FROM alliances FINAL WHERE allianceId IN ({ids:Array(UInt32)})',
    { ids: allianceIds }
  )
}

/**
 * Search alliances by name
 */
export async function searchAlliances(searchTerm: string, limit: number = 20): Promise<Alliance[]> {
  return await database.query<Alliance>(
    `SELECT * FROM alliances FINAL
     WHERE name ILIKE {search:String}
     ORDER BY name
     LIMIT {limit:UInt32}`,
    { search: `%${searchTerm}%`, limit }
  )
}

/**
 * Get alliance name by ID
 */
export async function getAllianceName(allianceId: number): Promise<string | null> {
  const name = await database.queryValue<string>(
    'SELECT name FROM alliances FINAL WHERE allianceId = {id:UInt32}',
    { id: allianceId }
  )
  return name || null
}

/**
 * Get alliance ticker by ID
 */
export async function getAllianceTicker(allianceId: number): Promise<string | null> {
  const ticker = await database.queryValue<string>(
    'SELECT ticker FROM alliances FINAL WHERE allianceId = {id:UInt32}',
    { id: allianceId }
  )
  return ticker || null
}

/**
 * Get alliances by executor corporation
 */
export async function getAlliancesByExecutor(corporationId: number): Promise<Alliance[]> {
  return await database.query<Alliance>(
    'SELECT * FROM alliances FINAL WHERE executorCorporationId = {corpId:UInt32}',
    { corpId: corporationId }
  )
}

/**
 * Get alliances by creator
 */
export async function getAlliancesByCreator(characterId: number): Promise<Alliance[]> {
  return await database.query<Alliance>(
    'SELECT * FROM alliances FINAL WHERE creatorId = {charId:UInt32}',
    { charId: characterId }
  )
}

/**
 * Count total alliances
 */
export async function countAlliances(): Promise<number> {
  return await database.count('alliances', '')
}

/**
 * Store or update alliance data
 */
export async function storeAlliance(
  allianceId: number,
  data: {
    creatorCorporationId: number
    creatorId: number
    dateFounded: string
    executorCorporationId: number
    name: string
    ticker: string
  }
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  await database.bulkInsert('alliances', [
    {
      allianceId: allianceId,
      creatorCorporationId: data.creatorCorporationId,
      creatorId: data.creatorId,
      date_founded: data.dateFounded,
      executorCorporationId: data.executorCorporationId,
      name: data.name,
      ticker: data.ticker,
      updated_at: now,
      version: now
    }
  ])
}

/**
 * Bulk store alliance data (for backfill/import)
 */
export async function storeAlliancesBulk(
  alliances: Array<{
    allianceId: number
    creatorCorporationId: number
    creatorId: number
    dateFounded: string
    executorCorporationId: number
    name: string
    ticker: string
  }>
): Promise<void> {
  if (alliances.length === 0) return

  const now = Math.floor(Date.now() / 1000)

  const records = alliances.map(alliance => ({
    allianceId: alliance.allianceId,
    creatorCorporationId: alliance.creatorCorporationId,
    creatorId: alliance.creatorId,
    dateFounded: alliance.dateFounded,
    executorCorporationId: alliance.executorCorporationId,
    name: alliance.name,
    ticker: alliance.ticker,
    updatedAt: now,
    version: now
  }))

  await database.bulkInsert('alliances', records)
}

/**
 * Check if alliance exists
 */
export async function allianceExists(allianceId: number): Promise<boolean> {
  const count = await database.count('alliances', 'allianceId = {id:UInt32}', { id: allianceId })
  return count > 0
}
