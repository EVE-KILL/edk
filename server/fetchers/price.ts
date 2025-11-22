/**
 * Price Fetcher
 *
 * Fetches price data from ESI API
 */

import type { PriceAPIResponse } from '../models/prices';
import { fetchESI } from '../helpers/esi';

let allPrices: PriceAPIResponse[] = [];
let lastPriceFetch = 0;

async function fetchAllPrices() {
  const now = Date.now();
  if (now - lastPriceFetch < 3600000) {
    // 1 hour cache
    return;
  }

  try {
    const response = await fetchESI<PriceAPIResponse[]>('/markets/prices/');
    if (response.ok && Array.isArray(response.data)) {
      allPrices = response.data;
      lastPriceFetch = now;
    }
  } catch (error) {
    console.error(
      '[Price Fetcher] Failed to fetch market prices from ESI:',
      error
    );
  }
}

/**
 * Fetch price data for a type from ESI
 *
 * @param typeId Type ID to fetch prices for
 * @returns Array of price data
 */
export async function fetchPrices(typeId: number): Promise<PriceAPIResponse[]> {
  await fetchAllPrices();

  const price = allPrices.find((p) => p.type_id === typeId);

  if (price) {
    // ESI returns adjusted_price and average_price, add today's date
    return [
      {
        ...price,
        date: new Date().toISOString().split('T')[0],
        region_id: 10000002, // The Forge
      },
    ];
  }

  return [];
}

/**
 * Fetch price data for a specific historical date
 * ESI does not support historical prices, so this will return the current price
 *
 * @param typeId Type ID to fetch prices for
 * @param targetDate Target date to get price for (Date object or ISO string)
 * @returns Array of price data around that date
 */
export async function fetchHistoricalPrices(
  typeId: number,
  targetDate: Date | string
): Promise<PriceAPIResponse[]> {
  return await fetchPrices(typeId);
}
