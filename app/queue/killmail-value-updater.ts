import { BaseWorker } from "../../src/queue/base-worker";
import type { Job } from "../../db/schema/jobs";
import { logger } from "../../src/utils/logger";
import { db } from "../../src/db";
import { killmails, victims, items, prices } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";
import { priceService } from "../services/price-service";

/**
 * Killmail Value Updater Worker
 *
 * Updates the ISK value for killmails by:
 * 1. Fetching all items/ship for the killmail
 * 2. Fetching prices from API (with LRU cache)
 * 3. Calculating ship, fitted, dropped, destroyed, and total values
 * 4. Updating killmail values in database
 *
 * This runs AFTER killmail-fetcher completes and is fast because:
 * - Prices are cached in LRU (no repeated API calls)
 * - Simple database UPDATE at the end
 * - Can run with high concurrency (10 workers)
 */
export class KillmailValueUpdater extends BaseWorker<{
  killmailDbId: number;
  killmailTime: Date | string;
}> {
  override queueName = "killmail-value";
  override concurrency = 10; // Process 10 value updates at once
  override pollInterval = 500; // Check every 500ms (faster polling)

  override async handle(
    payload: { killmailDbId: number; killmailTime: Date | string },
    job: Job
  ) {
    const { killmailDbId, killmailTime } = payload;

    // Ensure killmailTime is a Date object (it might come as string from JSON)
    const killmailDate = typeof killmailTime === "string" ? new Date(killmailTime) : killmailTime;

    logger.info(`💰 [Value Update] Starting for killmail DB ID ${killmailDbId}`);

    try {
      // Get victim ship type
      const victim = await db
        .select()
        .from(victims)
        .where(eq(victims.killmailId, killmailDbId))
        .get();

      if (!victim) {
        logger.warn(`  ↳ No victim found for killmail DB ID ${killmailDbId}`);
        return;
      }

      // Fetch all items for this killmail
      const killmailItems = await db
        .select()
        .from(items)
        .where(eq(items.killmailId, killmailDbId));

      logger.debug(`  ↳ Found ${killmailItems.length} items for killmail DB ID ${killmailDbId}`);

      // Collect all type IDs (ship + items)
      const typeIds = new Set<number>();
      typeIds.add(victim.shipTypeId);
      for (const item of killmailItems) {
        typeIds.add(item.itemTypeId);
      }

      logger.debug(`  ↳ Fetching prices for ${typeIds.size} unique types`);

      // Fetch prices for all types (uses LRU cache internally)
      const typeIdArray = Array.from(typeIds);
      const priceMap = await this.fetchPricesForTypes(typeIdArray, killmailDate);

      // Calculate values
      let shipValue = 0;
      let droppedValue = 0;
      let destroyedValue = 0;

      // Ship value
      const shipPrice = priceMap.get(victim.shipTypeId);
      if (shipPrice) {
        shipValue = shipPrice.average;
      }

      // Item values
      for (const item of killmailItems) {
        const price = priceMap.get(item.itemTypeId);
        if (!price) continue;

        const itemValue = item.quantity * price.average;

        if (item.dropped) {
          droppedValue += itemValue;
        }
        if (item.destroyed) {
          destroyedValue += itemValue;
        }
      }

      const fittedValue = droppedValue + destroyedValue;
      const totalValue = shipValue + fittedValue;

      logger.debug(`  ↳ Calculated values: ship=${shipValue.toFixed(2)}, fitted=${fittedValue.toFixed(2)}, total=${totalValue.toFixed(2)}`);

      // Update killmail with calculated values
      await db
        .update(killmails)
        .set({
          shipValue: shipValue.toFixed(2),
          fittedValue: fittedValue.toFixed(2),
          droppedValue: droppedValue.toFixed(2),
          destroyedValue: destroyedValue.toFixed(2),
          totalValue: totalValue.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(killmails.id, killmailDbId));

      logger.info(
        `✅ [Value Update] Completed for killmail DB ID ${killmailDbId}: ${totalValue.toFixed(2)} ISK (ship: ${shipValue.toFixed(2)}, fitted: ${fittedValue.toFixed(2)})`
      );
    } catch (error) {
      logger.error(`❌ [Value Update] Failed for killmail DB ID ${killmailDbId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch prices for type IDs, finding closest to target date
   * Uses price service which has LRU caching
   */
  private async fetchPricesForTypes(
    typeIds: number[],
    targetDate: Date
  ): Promise<Map<number, { average: number }>> {
    if (typeIds.length === 0) {
      return new Map();
    }

    const priceMap = new Map<number, { average: number }>();
    const targetDateUnix = Math.floor(targetDate.getTime() / 1000);

    // Check database first for all types (single query)
    const priceRecords = await db
      .select()
      .from(prices)
      .where(inArray(prices.typeId, typeIds));

    // Group prices by typeId
    const pricesByType = new Map<number, typeof priceRecords>();
    for (const record of priceRecords) {
      if (!pricesByType.has(record.typeId)) {
        pricesByType.set(record.typeId, []);
      }
      pricesByType.get(record.typeId)?.push(record);
    }

    // Process each type
    for (const typeId of typeIds) {
      const records = pricesByType.get(typeId);

      // If we have prices in database, find closest to target date
      if (records && records.length > 0) {
        let closestRecord = records[0];
        let minDiff = closestRecord?.date
          ? Math.abs(new Date(closestRecord.date).getTime() - targetDate.getTime())
          : Infinity;

        for (const record of records) {
          if (!record.date) continue;
          const diff = Math.abs(
            new Date(record.date).getTime() - targetDate.getTime()
          );
          if (diff < minDiff) {
            minDiff = diff;
            closestRecord = record;
          }
        }

        if (closestRecord?.average) {
          priceMap.set(typeId, { average: closestRecord.average });
          continue;
        }
      }

      // No price in database - fetch from API (uses LRU cache)
      try {
        logger.debug(`  ↳ Fetching price from API for type ${typeId}`);
        const priceData = await priceService.getPriceForTypeOnDate(typeId, targetDateUnix);

        if (priceData.length > 0) {
          const firstRecord = priceData[0];
          if (!firstRecord) continue;

          let closestPriceRecord = firstRecord;
          let minDiff = Math.abs(new Date(firstRecord.date).getTime() - targetDate.getTime());

          for (const record of priceData) {
            const diff = Math.abs(new Date(record.date).getTime() - targetDate.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closestPriceRecord = record;
            }
          }

          const avgPrice = closestPriceRecord.average;

          // Save to database for future use
          const priceDate = new Date(closestPriceRecord.date);
          priceDate.setHours(0, 0, 0, 0);

          await db.insert(prices).values({
            typeId,
            date: priceDate,
            average: avgPrice,
            highest: closestPriceRecord.highest,
            lowest: closestPriceRecord.lowest,
            orderCount: closestPriceRecord.order_count,
            volume: closestPriceRecord.volume,
          }).onConflictDoNothing();

          priceMap.set(typeId, { average: avgPrice });
          logger.debug(`  ↳ Fetched and saved price for type ${typeId}: ${avgPrice.toFixed(2)} ISK`);
        } else {
          logger.debug(`  ↳ No price data available for type ${typeId}`);
        }
      } catch (error) {
        logger.debug(`  ↳ Could not fetch price for type ${typeId}, skipping`);
        // Continue without price for this item
      }
    }

    logger.debug(`  ↳ Price fetch complete: ${priceMap.size} prices found out of ${typeIds.length} types`);
    return priceMap;
  }
}
