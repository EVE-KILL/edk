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
  region_id?: number
  date?: string // ISO date string
  type_id: number
  average_price?: number
  adjusted_price?: number
  average?: number
  highest?: number
  lowest?: number
  order_count?: number
  volume?: number
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

  const [row] = await database.sql<Price[]>`
    SELECT
      "typeId",
      "regionId",
      TO_CHAR("priceDate", 'YYYY-MM-DD') as "priceDate",
      "averagePrice",
      "highestPrice",
      "lowestPrice",
      "orderCount",
      "volume",
      TO_CHAR("updatedAt", 'YYYY-MM-DD HH24:MI:SS') as "updatedAt"
    FROM prices
    WHERE "typeId" = ${typeId}
      AND "regionId" = ${regionId}
      AND "priceDate" = ${queryDate}
    ORDER BY "updatedAt" DESC
    LIMIT 1
  `

  return row || null
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
  return await database.sql<Price[]>`
    SELECT
      "typeId",
      "regionId",
      TO_CHAR("priceDate", 'YYYY-MM-DD') as "priceDate",
      "averagePrice",
      "highestPrice",
      "lowestPrice",
      "orderCount",
      "volume",
      TO_CHAR("updatedAt", 'YYYY-MM-DD HH24:MI:SS') as "updatedAt"
    FROM prices
    WHERE "typeId" = ${typeId}
      AND "regionId" = ${regionId}
      AND "priceDate" >= CURRENT_DATE - (${days} || ' days')::interval
    ORDER BY "priceDate" DESC
  `
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
  const [row] = await database.sql<Price[]>`
    SELECT
      "typeId",
      "regionId",
      TO_CHAR("priceDate", 'YYYY-MM-DD') as "priceDate",
      "averagePrice",
      "highestPrice",
      "lowestPrice",
      "orderCount",
      "volume",
      TO_CHAR("updatedAt", 'YYYY-MM-DD HH24:MI:SS') as "updatedAt"
    FROM prices
    WHERE "typeId" = ${typeId}
      AND "regionId" = ${regionId}
    ORDER BY "priceDate" DESC, "updatedAt" DESC
    LIMIT 1
  `

  return row || null
}

/**
 * Store price data from API response
 * @param data Array of price data from eve-kill.com API
 */
export async function storePrices(data: PriceAPIResponse[]): Promise<void> {
  if (data.length === 0) return

  const version = Date.now()
  const today = new Date().toISOString().split('T')[0]

  const records = data
    .filter(price => price.date || price.average_price || price.average) // Skip invalid prices
    .map((price) => ({
      typeId: price.type_id,
      regionId: price.region_id || 10000002, // Default to The Forge if not specified
      priceDate: price.date ? price.date.split('T')[0] : today, // Use today if no date
      averagePrice: price.average || price.average_price || 0,
      highestPrice: price.highest || price.average_price || 0,
      lowestPrice: price.lowest || price.average_price || 0,
      orderCount: price.order_count || 0,
      volume: price.volume || 0,
      updatedAt: new Date(), // Postgres timestamp
      version
    }))

  try {
    // Postgres bulk upsert to handle duplicates
    await database.bulkUpsert('prices', records, ['typeId', 'regionId', 'priceDate'])
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
  const [result] = await database.sql<{count: number}[]>`
    SELECT count(*) as count
    FROM prices
    WHERE "typeId" = ${typeId}
      AND "regionId" = ${regionId}
      AND "priceDate" >= CURRENT_DATE - (${maxAgeDays} || ' days')::interval
  `

  return Number(result?.count || 0) > 0
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

  let dateClause = database.sql``
  if (asOfDate) {
    const dateString = typeof asOfDate === 'string'
      ? asOfDate.split('T')[0]
      : asOfDate.toISOString().split('T')[0]

    dateClause = database.sql`AND "priceDate" <= ${dateString}`
  }

  // Postgres specific: Get latest price per typeId using DISTINCT ON
  const rows = await database.sql<{ typeId: number; averagePrice: number | null }[]>`
    SELECT DISTINCT ON ("typeId")
      "typeId",
      "averagePrice"
    FROM prices
    WHERE "regionId" = ${regionId}
      AND "typeId" = ANY(${typeIds})
      ${dateClause}
    ORDER BY "typeId", "priceDate" DESC, "version" DESC
  `

  const priceMap = new Map<number, number>()
  for (const row of rows) {
    priceMap.set(row.typeId, row.averagePrice ?? 0)
  }

  return priceMap
}
