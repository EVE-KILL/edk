/**
 * Prices Model
 *
 * Provides query methods for price data from eve-kill.com API
 */

import { logger } from '../helpers/logger'
import { database } from '../helpers/database'

export interface Price {
  type_id: number
  region_id: number
  price_date: string // Date in YYYY-MM-DD format
  average_price: number
  highest_price: number
  lowest_price: number
  order_count: number
  volume: number
  updated_at: string
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
      type_id,
      region_id,
      formatDateTime(price_date, '%Y-%m-%d') as price_date,
      average_price,
      highest_price,
      lowest_price,
      order_count,
      volume,
      formatDateTime(updated_at, '%Y-%m-%d %H:%i:%S') as updated_at
    FROM prices
    WHERE type_id = {typeId:UInt32}
      AND region_id = {regionId:UInt32}
      AND price_date = {date:Date}
    ORDER BY updated_at DESC
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
      type_id,
      region_id,
      formatDateTime(price_date, '%Y-%m-%d') as price_date,
      average_price,
      highest_price,
      lowest_price,
      order_count,
      volume,
      formatDateTime(updated_at, '%Y-%m-%d %H:%i:%S') as updated_at
    FROM prices
    WHERE type_id = {typeId:UInt32}
      AND region_id = {regionId:UInt32}
      AND price_date >= today() - INTERVAL {days:UInt32} DAY
    ORDER BY price_date DESC
  `

  return await database.query<Price>(sql, {
    typeId,
    regionId,
    days
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
      type_id,
      region_id,
      formatDateTime(price_date, '%Y-%m-%d') as price_date,
      average_price,
      highest_price,
      lowest_price,
      order_count,
      volume,
      formatDateTime(updated_at, '%Y-%m-%d %H:%i:%S') as updated_at
    FROM prices
    WHERE type_id = {typeId:UInt32}
      AND region_id = {regionId:UInt32}
    ORDER BY price_date DESC, updated_at DESC
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
    type_id: price.type_id,
    region_id: price.region_id,
    price_date: price.date.split('T')[0], // Extract YYYY-MM-DD
    average_price: price.average,
    highest_price: price.highest,
    lowest_price: price.lowest,
    order_count: price.order_count,
    volume: price.volume,
    updated_at: Math.floor(Date.now() / 1000), // Unix timestamp
    version
  }))

  try {
    await database.bulkInsert('edk.prices', records)
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
    SELECT count() as count
    FROM prices
    WHERE type_id = {typeId:UInt32}
      AND region_id = {regionId:UInt32}
      AND price_date >= today() - INTERVAL {maxAgeDays:UInt32} DAY
  `

  const count = await database.queryValue<number>(sql, {
    typeId,
    regionId,
    maxAgeDays
  })

  return (count || 0) > 0
}
