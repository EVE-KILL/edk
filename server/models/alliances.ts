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
}

/**
 * Get alliance by ID
 */
export async function getAlliance(allianceId: number): Promise<Alliance | null> {
  const [row] = await database.sql<Alliance[]>`
    SELECT * FROM alliances WHERE "allianceId" = ${allianceId}
  `
  return row || null
}

/**
 * Get multiple alliances by IDs
 */
export async function getAlliances(allianceIds: number[]): Promise<Alliance[]> {
  if (allianceIds.length === 0) return []

  return await database.sql<Alliance[]>`
    SELECT * FROM alliances WHERE "allianceId" = ANY(${allianceIds})
  `
}

/**
 * Search alliances by name
 */
export async function searchAlliances(searchTerm: string, limit: number = 20): Promise<Alliance[]> {
  return await database.sql<Alliance[]>`
    SELECT * FROM alliances
    WHERE name ILIKE ${`%${searchTerm}%`}
    ORDER BY name
    LIMIT ${limit}
  `
}

/**
 * Get alliance name by ID
 */
export async function getAllianceName(allianceId: number): Promise<string | null> {
  const [row] = await database.sql<{ name: string }[]>`
    SELECT name FROM alliances WHERE "allianceId" = ${allianceId}
  `
  return row?.name || null
}

/**
 * Get alliance ticker by ID
 */
export async function getAllianceTicker(allianceId: number): Promise<string | null> {
  const [row] = await database.sql<{ ticker: string }[]>`
    SELECT ticker FROM alliances WHERE "allianceId" = ${allianceId}
  `
  return row?.ticker || null
}

/**
 * Get alliances by executor corporation
 */
export async function getAlliancesByExecutorCorporation(corporationId: number): Promise<Alliance[]> {
  return await database.sql<Alliance[]>`
    SELECT * FROM alliances WHERE "executorCorporationId" = ${corporationId}
  `
}

/**
 * Get alliances by creator
 */
export async function getAlliancesByCreator(characterId: number): Promise<Alliance[]> {
  return await database.sql<Alliance[]>`
    SELECT * FROM alliances WHERE "creatorId" = ${characterId}
  `
}

/**
 * Count total alliances
 */
export async function countAlliances(): Promise<number> {
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count FROM alliances
  `
  return Number(result?.count || 0)
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

  await database.bulkUpsert('alliances', [
    {
      allianceId: allianceId,
      creatorCorporationId: data.creatorCorporationId,
      creatorId: data.creatorId,
      dateFounded: data.dateFounded, // Changed from snake_case (date_founded) to camelCase to match schema if needed, but check schema.
      executorCorporationId: data.executorCorporationId,
      name: data.name,
      ticker: data.ticker,
      updatedAt: new Date(now * 1000), // Changed from updated_at to updatedAt and using Date
    }
  ], ['allianceId'])
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
    updatedAt: new Date(now * 1000),
  }))

  await database.bulkInsert('alliances', records)
}

/**
 * Check if alliance exists
 */
export async function allianceExists(allianceId: number): Promise<boolean> {
  const [result] = await database.sql<{ count: number }[]>`
    SELECT count(*) as count FROM alliances WHERE "allianceId" = ${allianceId}
  `
  return Number(result?.count) > 0
}
