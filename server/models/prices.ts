/**
 * Prices Model
 *
 * Provides query methods for price data from eve-kill.com API
 */

import { logger } from '../helpers/logger';
import { database } from '../helpers/database';

export interface Price {
  typeId: number;
  regionId: number;
  priceDate: string; // Date in YYYY-MM-DD format
  averagePrice: number;
  highestPrice: number;
  lowestPrice: number;
  orderCount: number;
  volume: number;
}

export interface PriceAPIResponse {
  region_id?: number;
  date?: string; // ISO date string
  type_id: number;
  average_price?: number;
  adjusted_price?: number;
  average?: number;
  highest?: number;
  lowest?: number;
  order_count?: number;
  volume?: number;
}

// Default price region used for ISK calculations (The Forge / Jita)
const DEFAULT_PRICE_REGION_ID = 10000002;

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
  const queryDate = date || new Date().toISOString().split('T')[0];
  return database.findOne<Price>(
    `SELECT
      "typeId",
      "regionId",
      TO_CHAR("priceDate", 'YYYY-MM-DD') as "priceDate",
      "averagePrice",
      "highestPrice",
      "lowestPrice",
      "orderCount",
      "volume"
    FROM prices
    WHERE "typeId" = :typeId
      AND "regionId" = :regionId
      AND "priceDate" = :queryDate
    LIMIT 1`,
    { typeId, regionId, queryDate }
  );
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
  return database.find<Price>(
    `SELECT
      "typeId",
      "regionId",
      TO_CHAR("priceDate", 'YYYY-MM-DD') as "priceDate",
      "averagePrice",
      "highestPrice",
      "lowestPrice",
      "orderCount",
      "volume"
    FROM prices
    WHERE "typeId" = :typeId
      AND "regionId" = :regionId
      AND "priceDate" >= CURRENT_DATE - (:days || ' days')::interval
    ORDER BY "priceDate" DESC`,
    { typeId, regionId, days }
  );
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
  return database.findOne<Price>(
    `SELECT
      "typeId",
      "regionId",
      TO_CHAR("priceDate", 'YYYY-MM-DD') as "priceDate",
      "averagePrice",
      "highestPrice",
      "lowestPrice",
      "orderCount",
      "volume"
    FROM prices
    WHERE "typeId" = :typeId
      AND "regionId" = :regionId
    ORDER BY "priceDate" DESC
    LIMIT 1`,
    { typeId, regionId }
  );
}

/**
 * Store price data from API response
 * @param data Array of price data from eve-kill.com API
 */
export async function storePrices(data: PriceAPIResponse[]): Promise<void> {
  if (data.length === 0) return;

  const today = new Date().toISOString().split('T')[0];

  const records = data
    .filter((price) => price.date || price.average_price || price.average) // Skip invalid prices
    .map((price) => ({
      typeId: price.type_id,
      regionId: price.region_id || 10000002, // Default to The Forge if not specified
      priceDate: price.date ? price.date.split('T')[0] : today, // Use today if no date
      averagePrice: price.average || price.average_price || 0,
      highestPrice: price.highest || price.average_price || 0,
      lowestPrice: price.lowest || price.average_price || 0,
      orderCount: price.order_count || 0,
      volume: price.volume || 0,
    }));

  try {
    // Postgres bulk upsert to handle duplicates
    await database.bulkUpsert('prices', records, [
      'typeId',
      'regionId',
      'priceDate',
    ]);
  } catch (error) {
    logger.error(
      `[Prices] Failed to store prices for type ${data[0].type_id}`,
      { error, sample: records[0] }
    );
    throw error;
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
  const result = await database.findOne<{ count: number }>(
    `SELECT count(*) as count
    FROM prices
    WHERE "typeId" = :typeId
      AND "regionId" = :regionId
      AND "priceDate" >= CURRENT_DATE - (:maxAgeDays || ' days')::interval`,
    { typeId, regionId, maxAgeDays }
  );

  return Number(result?.count || 0) > 0;
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
    return new Map();
  }

  let dateClause = '';
  const params: Record<string, unknown> = { regionId, typeIds };
  if (asOfDate) {
    const dateString =
      typeof asOfDate === 'string'
        ? asOfDate.split('T')[0]
        : asOfDate.toISOString().split('T')[0];

    dateClause = 'AND "priceDate" <= :dateString';
    params.dateString = dateString;
  }

  const rows = await database.find<{
    typeId: number;
    averagePrice: number | null;
  }>(
    `SELECT DISTINCT ON ("typeId", "regionId")
      "typeId",
      "averagePrice"
    FROM prices
    WHERE "regionId" = :regionId
      AND "typeId" = ANY(:typeIds)
      AND "volume" > 0
      ${dateClause}
    ORDER BY "typeId", "regionId", "priceDate" DESC`,
    params
  );

  const priceMap = new Map<number, number>();
  for (const row of rows) {
    priceMap.set(row.typeId, row.averagePrice ?? 0.01);
  }

  return priceMap;
}

/**
 * Get custom price for a type ID (hardcoded prices for rare/special items)
 *
 * @param typeId Type ID to check
 * @param asOfDate Optional date for time-based pricing
 * @returns Custom price if found, null otherwise
 */
export async function getCustomPrice(
  typeId: number,
  asOfDate?: string | Date
): Promise<number | null> {
  const dateString = asOfDate
    ? typeof asOfDate === 'string'
      ? asOfDate.split('T')[0]
      : asOfDate.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const result = await database.findOne<{ customPrice: string }>(
    `SELECT "customPrice"
     FROM customprices
     WHERE "typeId" = :typeId
       AND ("validFrom" IS NULL OR "validFrom" <= :dateString)
       AND ("validUntil" IS NULL OR "validUntil" > :dateString)
     ORDER BY "validFrom" DESC NULLS LAST
     LIMIT 1`,
    { typeId, dateString }
  );

  return result ? Number(result.customPrice) : null;
}

/**
 * Calculate price based on reprocessing materials (typematerials)
 * This provides a more stable price estimate based on base material values
 * Used for items like Titans and Supercarriers where market prices are unreliable
 *
 * @param typeId Type ID to calculate price for
 * @param regionId Region ID for material prices (default: 10000002 - The Forge)
 * @param asOfDate Optional date for historical pricing
 * @returns Calculated price based on reprocessing materials, or 0 if no materials found
 */
export async function getPriceFromReprocessing(
  typeId: number,
  regionId: number = DEFAULT_PRICE_REGION_ID,
  asOfDate?: string | Date
): Promise<number> {
  // Get reprocessing materials for this type
  const materials = await database.find<{
    materialTypeId: number;
    quantity: number;
  }>(
    `SELECT "materialTypeId", "quantity"
     FROM typematerials
     WHERE "typeId" = :typeId`,
    { typeId }
  );

  if (materials.length === 0) {
    return 0;
  }

  // Get prices for all materials
  const materialTypeIds = materials.map((m) => m.materialTypeId);
  const materialPrices = await getLatestPricesForTypes(
    materialTypeIds,
    regionId,
    asOfDate
  );

  // Calculate total value
  let totalValue = 0;
  for (const material of materials) {
    const materialPrice = materialPrices.get(material.materialTypeId) ?? 0;
    totalValue += materialPrice * material.quantity;
  }

  return totalValue;
}
