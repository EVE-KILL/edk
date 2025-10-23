import { logger } from "../../src/utils/logger";
import { LRUCache } from "lru-cache";

/**
 * EVE-KILL Price Service
 * Fetches market price data from EVE-KILL.com API
 *
 * API Docs: https://eve-kill.com/docs/api/prices
 */
export class PriceService {
  private baseUrl = "https://eve-kill.com/api/prices";

  // LRU cache for price lookups (both successful and failed)
  // Cache failed lookups for 1 hour, successful for 5 minutes
  // Use special CACHE_MISS sentinel for failed lookups
  private readonly CACHE_MISS: IPrice[] = [];
  private priceCache = new LRUCache<string, IPrice[]>({
    max: 10000, // Cache up to 10k type lookups
    ttl: 1000 * 60 * 60, // 1 hour TTL default
    ttlAutopurge: true,
  });

  /**
   * Get price data for a specific item type
   * Returns last 14 days of price history for matching closest to killmail date
   */
  async getPriceForType(
    typeId: number,
    daysBack: number = 14
  ): Promise<IPrice[]> {
    try {
      const url = `${this.baseUrl}/type_id/${typeId}?days=${daysBack}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "EVE-Kill/4.0 (https://eve-kill.com)",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const prices = Array.isArray(data) ? data : [];
      logger.debug(`[PriceService] Fetched prices for type ${typeId}: ${prices.length} entries`);
      return prices;
    } catch (error) {
      logger.error(
        `[PriceService] Failed to fetch prices for type ${typeId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return [];
    }
  }

  /**
   * Get price data for a specific region
   */
  async getPriceForRegion(
    regionId: number,
    daysBack: number = 1
  ): Promise<IPrice[]> {
    try {
      const url = `${this.baseUrl}/region/${regionId}?days=${daysBack}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "EVE-Kill/4.0 (https://eve-kill.com)",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;
      const prices = Array.isArray(data) ? data : [];
      return prices;
    } catch (error) {
      logger.error(
        `Failed to fetch prices for region ${regionId}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return [];
    }
  }

  /**
   * Get price for a specific type on a specific date
   * Pass Unix timestamp (seconds) as dateUnix
   * Returns array of IPrice objects with fallback logic:
   * 1. Try date - 3 days for 14 days forward
   * 2. If empty, try last 30 days without date filter
   */
  async getPriceForTypeOnDate(
    typeId: number,
    dateUnix: number
  ): Promise<IPrice[]> {
    // Check cache first
    const cacheKey = `${typeId}:${dateUnix}`;
    const cached = this.priceCache.get(cacheKey);

    if (cached !== undefined) {
      // Cache hit - check if it's a cached failure (CACHE_MISS sentinel)
      if (cached === this.CACHE_MISS) {
        logger.debug(`[PriceService] Cache hit: No price data for type ${typeId} (cached failure)`);
        return [];
      }
      logger.debug(`[PriceService] Cache hit: ${cached.length} prices for type ${typeId}`);
      return cached;
    }

    try {
      // Strategy 1: Request from 3 days before the target date to account for missing data
      const threeDaysBeforeUnix = dateUnix - (3 * 24 * 60 * 60); // 3 days in seconds
      const url = `${this.baseUrl}/type_id/${typeId}?date=${threeDaysBeforeUnix}&days=14`;
      logger.debug(`[PriceService] Fetching price for type ${typeId} from date ${threeDaysBeforeUnix} (3 days before ${dateUnix})`);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "EVE-Kill/4.0 (https://eve-kill.com)",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        logger.warn(`[PriceService] HTTP ${response.status} for type ${typeId}`);
        // Cache HTTP errors as failed lookup
        this.priceCache.set(cacheKey, this.CACHE_MISS, { ttl: 1000 * 60 * 60 });
        return [];
      }

      const data = await response.json() as IPrice[];
      const prices = Array.isArray(data) ? data : [];

      if (prices.length > 0) {
        logger.debug(`[PriceService] Fetched ${prices.length} price entries for type ${typeId} from date strategy`);
        // Cache successful result with shorter TTL (5 minutes)
        this.priceCache.set(cacheKey, prices, { ttl: 1000 * 60 * 5 });
        return prices;
      }

      // Strategy 2: If no results, try last 30 days without date filter
      logger.debug(`[PriceService] No prices from date strategy, trying last 30 days for type ${typeId}`);

      const fallbackUrl = `${this.baseUrl}/type_id/${typeId}?days=30`;
      const fallbackResponse = await fetch(fallbackUrl, {
        headers: {
          "User-Agent": "EVE-Kill/4.0 (https://eve-kill.com)",
          Accept: "application/json",
        },
      });

      if (!fallbackResponse.ok) {
        logger.warn(`[PriceService] Fallback HTTP ${fallbackResponse.status} for type ${typeId}`);
        // Cache HTTP errors as failed lookup
        this.priceCache.set(cacheKey, this.CACHE_MISS, { ttl: 1000 * 60 * 60 });
        return [];
      }

      const fallbackData = await fallbackResponse.json() as IPrice[];
      const fallbackPrices = Array.isArray(fallbackData) ? fallbackData : [];

      if (fallbackPrices.length > 0) {
        logger.debug(`[PriceService] Fetched ${fallbackPrices.length} price entries for type ${typeId} from 30-day fallback`);
        // Cache successful result with shorter TTL (5 minutes)
        this.priceCache.set(cacheKey, fallbackPrices, { ttl: 1000 * 60 * 5 });
      } else {
        logger.warn(`[PriceService] No price data available for type ${typeId} in last 30 days`);
        // Cache failed lookup with longer TTL (1 hour) to avoid repeated failed queries
        this.priceCache.set(cacheKey, this.CACHE_MISS, { ttl: 1000 * 60 * 60 });
      }

      return fallbackPrices;
    } catch (error) {
      logger.error(
        `[PriceService] Failed to fetch prices for type ${typeId} on date ${dateUnix}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      // Cache error as failed lookup
      this.priceCache.set(cacheKey, this.CACHE_MISS, { ttl: 1000 * 60 * 60 });
      return [];
    }
  }

  /**
   * Get price count to check data availability
   */
  async getPriceCount(): Promise<number> {
    try {
      const url = `${this.baseUrl}/count`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "EVE-Kill/4.0 (https://eve-kill.com)",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as { count: number };
      return data.count || 0;
    } catch (error) {
      logger.error(
        `Failed to fetch price count: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return 0;
    }
  }
}

/**
 * Interface for price data from EVE-KILL API
 */
export interface IPrice {
  type_id: number;
  region_id?: number;
  date: string; // ISO 8601 timestamp
  average: number;
  highest: number;
  lowest: number;
  order_count: number;
  volume: number;
}

// Export singleton instance
export const priceService = new PriceService();
