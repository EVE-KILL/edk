/**
 * Price Fetcher
 *
 * Fetches price data from eve-kill.com API
 */

import type { PriceAPIResponse } from '../models/prices'
import { logger } from '../helpers/logger'
import { fetchEveKill } from '../helpers/fetcher'

/**
 * Fetch price data for a type from eve-kill.com
 * With fallback logic for historical dates
 *
 * @param typeId Type ID to fetch prices for
 * @param days Number of days of history to fetch (default: 14)
 * @param date Optional Unix timestamp - fetches data 3 days before this date with specified window
 * @returns Array of price data
 */
export async function fetchPrices(
  typeId: number,
  days: number = 14,
  date?: number
): Promise<PriceAPIResponse[]> {
  // If no date specified, fetch current prices
  if (!date) {
    const path = `/prices/type_id/${typeId}?days=${days}`

    try {
      const response = await fetchEveKill<PriceAPIResponse[]>(path)

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn(`[Price Fetcher] Invalid response for type ${typeId}`)
        return []
      }

      return response.data
    } catch (error) {
      logger.error(`[Price Fetcher] Error fetching prices for type ${typeId}:`, { error })
      return []
    }
  }

  // Historical fetch with fallbacks
  const attempts = [
    { days: 14, date },
    { days: 30, date },
    { days: 90, date },
    { days: 14, date: undefined } // Fallback to current prices
  ]

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]
    let path = `/prices/type_id/${typeId}?days=${attempt.days}`

    if (attempt.date) {
      path += `&date=${attempt.date}`
    }

    try {
      const response = await fetchEveKill<PriceAPIResponse[]>(path)

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data
      }
    } catch (error) {
      // Continue to next attempt
    }
  }

  // All attempts failed - only log once at the end
  logger.warn(`[Price Fetcher] No price data found for type ${typeId}`)
  return []
}

/**
 * Fetch price data for a specific historical date
 * Uses the recommended approach: fetch 3 days before the target date with a 14 day window
 *
 * @param typeId Type ID to fetch prices for
 * @param targetDate Target date to get price for (Date object or ISO string)
 * @returns Array of price data around that date
 */
export async function fetchHistoricalPrices(
  typeId: number,
  targetDate: Date | string
): Promise<PriceAPIResponse[]> {
  const date = typeof targetDate === 'string' ? new Date(targetDate) : targetDate

  // Calculate 3 days before target date
  const fetchDate = new Date(date)
  fetchDate.setDate(fetchDate.getDate() - 3)

  const unixTimestamp = Math.floor(fetchDate.getTime() / 1000)

  return await fetchPrices(typeId, 14, unixTimestamp)
}
