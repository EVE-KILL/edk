/**
 * Prices Model
 *
 * Provides query methods for price data from eve-kill.com API
 */

import { logger } from '../helpers/logger'
import { database } from '../helpers/database'

export interface Price {
  typeId: number
  regionId: number
  priceDate: string // Date in YYYY-MM-DD format
  averagePrice: number
  highestPrice: number
  lowestPrice: number
  orderCount: number
  volume: number
  updatedAt: string
}

export interface PriceAPIResponse {
  region_id: number
  date: string // ISO date string
  type_id: number
  average: number
  highest: number
  lowest: number
  order_count: number
  volume: number
}

// Default price region used for ISK calculations (The Forge / Jita)
const DEFAULT_PRICE_REGION_ID = 10000002

/**
 * Get price for a specific type on a specific date (or closest available)
 * @param typeId Type ID
 * @param regionId Region ID (default: 10000002 - The Forge)
 * @param date Date to query (YYYY-MM-DD format, defaults to today)
 * @returns Price data or null if not found
 */
export async function getPrice(
  typeId: number,
  regionId: number = 10000002,
  date?: string
): Promise<Price | null> {
  const queryDate = date || new Date().toISOString().split('T')[0]

  const sql = `
    SELECT
      typeId,
      regionId,
      TO_CHAR(priceDate, 'YYYY-MM-DD') as priceDate,
      averagePrice,
      highestPrice,
      lowestPrice,
      orderCount,
      volume,
      TO_CHAR(updatedAt, 'YYYY-MM-DD HH24:MI:SS') as updatedAt
    FROM prices
    WHERE typeId = {typeId:UInt32}
      AND regionId = {regionId:UInt32}
      AND priceDate = {date:Date}
    ORDER BY updatedAt DESC
    LIMIT 1
  `

  return await database.queryOne<Price>(sql, {
    typeId,
    regionId,
    date: queryDate
  })
}

/**
 * Get price history for a type over a date range
 * @param typeId Type ID
 * @param regionId Region ID (default: 10000002 - The Forge)
 * @param days Number of days to look back (default: 14)
 * @returns Array of price data
 */
export async function getPriceHistory(
  typeId: number,
  regionId: number = 10000002,
  days: number = 14
): Promise<Price[]> {
  const sql = `
    SELECT
      typeId,
      regionId,
      TO_CHAR(priceDate, 'YYYY-MM-DD') as priceDate,
      averagePrice,
      highestPrice,
      lowestPrice,
      orderCount,
      volume,
      TO_CHAR(updatedAt, 'YYYY-MM-DD HH24:MI:SS') as updatedAt
    FROM prices
    WHERE typeId = {typeId:UInt32}
      AND regionId = {regionId:UInt32}
      AND priceDate >= CURRENT_DATE - INTERVAL '${days} days'
    ORDER BY priceDate DESC
  `

  return await database.query<Price>(sql, {
    typeId,
    regionId
  })
}

/**
 * Get the most recent price for a type (any date)
 * @param typeId Type ID
 * @param regionId Region ID (default: 10000002 - The Forge)
 * @returns Most recent price or null
 */
export async function getLatestPrice(
  typeId: number,
  regionId: number = 10000002
): Promise<Price | null> {
  const sql = `
    SELECT
      typeId,
      regionId,
      TO_CHAR(priceDate, 'YYYY-MM-DD') as priceDate,
      averagePrice,
      highestPrice,
      lowestPrice,
      orderCount,
      volume,
      TO_CHAR(updatedAt, 'YYYY-MM-DD HH24:MI:SS') as updatedAt
    FROM prices
    WHERE typeId = {typeId:UInt32}
      AND regionId = {regionId:UInt32}
    ORDER BY priceDate DESC, updatedAt DESC
    LIMIT 1
  `

  return await database.queryOne<Price>(sql, {
    typeId,
    regionId
  })
}

/**
 * Store price data from API response
 * @param data Array of price data from eve-kill.com API
 */
export async function storePrices(data: PriceAPIResponse[]): Promise<void> {
  if (data.length === 0) return

  const version = Date.now()

  const records = data.map((price) => ({
    typeId: price.type_id,
    regionId: price.region_id,
    priceDate: price.date.split('T')[0], // Extract YYYY-MM-DD
    averagePrice: price.average,
    highestPrice: price.highest,
    lowestPrice: price.lowest,
    orderCount: price.order_count,
    volume: price.volume,
    updatedAt: new Date(), // Postgres timestamp
    version
  }))

  try {
    // Postgres bulk insert (or upsert if primary key constraint exists)
    // The prices table has PRIMARY KEY (typeId, regionId, priceDate)
    // We should probably use ON CONFLICT DO UPDATE if duplicates are possible within the same batch or updates
    // But database.bulkInsert assumes simple insert.
    // If we need upsert, we might need a custom query or loop.
    // Assuming simple insert for now or relying on errors being ignored/handled.
    // If `storePrices` implies updating existing daily records, we need upsert.

    // For now, using bulkInsert as it maps to INSERT.
    await database.bulkInsert('prices', records)
  } catch (error) {
    logger.error(`[Prices] Failed to store prices for type ${data[0].type_id}`, { error, sample: records[0] })
    throw error
  }
}

/**
 * Check if we have recent price data for a type
 * @param typeId Type ID
 * @param regionId Region ID
 * @param maxAgeDays Maximum age in days to consider "recent"
 * @returns True if we have recent data
 */
export async function hasRecentPrice(
  typeId: number,
  regionId: number = 10000002,
  maxAgeDays: number = 3
): Promise<boolean> {
  const sql = `
    SELECT count(*) as count
    FROM prices
    WHERE typeId = {typeId:UInt32}
      AND regionId = {regionId:UInt32}
      AND priceDate >= CURRENT_DATE - INTERVAL '${maxAgeDays} days'
  `

  const count = await database.queryValue<number>(sql, {
    typeId,
    regionId
  })

  return (count || 0) > 0
}

/**
 * Get the latest available average price for multiple types in a single query.
 * Optionally restricts prices to those published on or before a specific date.
 */
export async function getLatestPricesForTypes(
  typeIds: number[],
  regionId: number = DEFAULT_PRICE_REGION_ID,
  asOfDate?: string | Date
): Promise<Map<number, number>> {
  if (typeIds.length === 0) {
    return new Map()
  }

  const params: Record<string, unknown> = {
    typeIds,
    regionId
  }

  let dateClause = ''
  if (asOfDate) {
    const dateString = typeof asOfDate === 'string'
      ? asOfDate.split('T')[0]
      : asOfDate.toISOString().split('T')[0]

    params.asOfDate = dateString
    dateClause = 'AND priceDate <= {asOfDate:Date}'
  }

  // Postgres specific: Get latest price per typeId using DISTINCT ON
  // CH uses argMax.
  const rows = await database.query<{ typeId: number; averagePrice: number | null }>(`
    SELECT DISTINCT ON (typeId)
      typeId,
      averagePrice
    FROM prices
    WHERE regionId = {regionId:UInt32}
      AND typeId = ANY({typeIds:Array(UInt32)})
      ${dateClause}
    ORDER BY typeId, priceDate DESC, version DESC
  `, params)

  const priceMap = new Map<number, number>()
  for (const row of rows) {
    priceMap.set(row.typeId, row.averagePrice ?? 0)
  }

  return priceMap
}
