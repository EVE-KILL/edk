import { logger } from "../../src/utils/logger";

/**
 * EVE-KILL Price Service
 * Fetches market price data from EVE-KILL.com API
 *
 * API Docs: https://eve-kill.com/docs/api/prices
 */
export class PriceService {
  private baseUrl = "https://eve-kill.com/api/prices";
  private requestDelay = 100; // ms between requests to respect rate limits
  private lastRequestTime = 0;

  /**
   * Get price data for a specific item type
   * Returns last 14 days of price history for matching closest to killmail date
   */
  async getPriceForType(
    typeId: number,
    daysBack: number = 14
  ): Promise<IPrice[]> {
    await this.throttle();

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
    await this.throttle();

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
   */
  async getPriceForTypeOnDate(
    typeId: number,
    dateUnix: number
  ): Promise<IPrice[]> {
    await this.throttle();

    try {
      const url = `${this.baseUrl}/type_id/${typeId}?date=${dateUnix}`;
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
        `Failed to fetch prices for type ${typeId} on date ${dateUnix}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      return [];
    }
  }

  /**
   * Get price count to check data availability
   */
  async getPriceCount(): Promise<number> {
    await this.throttle();

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

  /**
   * Throttle requests to respect rate limits
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.requestDelay - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
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
