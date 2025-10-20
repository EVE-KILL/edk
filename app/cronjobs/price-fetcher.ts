import { BaseCronjob, type CronjobResult } from "../../src/scheduler/base-cronjob";
import { db } from "../../src/db";
import { prices } from "../../db/schema";
import { priceService } from "../services/price-service";
import { eq, and, gte, lte } from "drizzle-orm";

/**
 * Price Fetcher Cronjob
 * Fetches daily market prices from EVE-KILL API and stores them in the database
 * Runs daily at 4:00 AM, fetching prices for the previous day
 *
 * This enriches killmails with accurate pricing data for the day they occurred
 */
export default class PriceFetcherCronjob extends BaseCronjob {
  metadata = {
    name: "price-fetcher",
    description: "Fetch and cache daily market prices from EVE-KILL API",
    schedule: "0 4 * * *", // Daily at 4 AM (UTC)
    timeout: 600000, // 10 minutes
  };

  async execute(): Promise<CronjobResult> {
    try {
      this.info("Starting price fetch...");

      // Get yesterday's date for fetching prices
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const startOfDay = Math.floor(yesterday.getTime() / 1000);

      // Get common item types from recent killmails
      const typeIds = await this.getCommonTypeIds();

      if (typeIds.length === 0) {
        this.warn("No item types found in killmails, skipping price fetch");
        return {
          success: true,
          message: "No types to fetch",
        };
      }

      this.info(`Fetching prices for ${typeIds.length} item types...`);

      let fetched = 0;
      let stored = 0;
      let failed = 0;

      for (const typeId of typeIds) {
        try {
          const priceData = await priceService.getPriceForTypeOnDate(
            typeId,
            startOfDay
          );

          if (priceData.length > 0) {
            // Take the average price across all regions
            const avgPrice = priceData.reduce((sum, p) => sum + p.average, 0) / priceData.length;
            const highPrice = Math.max(...priceData.map((p) => p.highest));
            const lowPrice = Math.min(...priceData.map((p) => p.lowest));
            const totalVolume = priceData.reduce((sum, p) => sum + (p.volume || 0), 0);
            const totalOrders = priceData.reduce((sum, p) => sum + (p.order_count || 0), 0);

            // Check if price already exists for this date
            const existing = await db
              .select()
              .from(prices)
              .where(
                and(
                  eq(prices.typeId, typeId),
                  eq(prices.date, yesterday)
                )
              )
              .limit(1)
              .get();

            if (!existing) {
              await db.insert(prices).values({
                typeId,
                date: yesterday,
                average: avgPrice,
                highest: highPrice,
                lowest: lowPrice,
                orderCount: totalOrders,
                volume: totalVolume,
              });
              stored++;
            }

            fetched++;
          }
        } catch (error) {
          failed++;
          this.warn(
            `Failed to fetch price for type ${typeId}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }

        // Small delay between requests
        await this.sleep(50);
      }

      return {
        success: true,
        message: `Fetched: ${fetched}, Stored: ${stored}, Failed: ${failed}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.error(`Price fetch failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Get list of common item types from recent killmails
   * Focuses on frequently-appearing items
   */
  private async getCommonTypeIds(): Promise<number[]> {
    const items = await db
      .select({ typeId: prices.typeId })
      .from(prices)
      .limit(1000)
      .all();

    const typeIds = new Set(items.map((i) => i.typeId));
    return Array.from(typeIds).slice(0, 100); // Limit to top 100 types
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
