import { BaseWorker } from "../../src/queue/base-worker";
import { priceService } from "../services/price-service";
import { logger } from "../../src/utils/logger";
import { db } from "../../src/db";
import { prices } from "../../db/schema";
import { eq, and } from "drizzle-orm";

interface PriceFetchPayload {
  killmailId: number;
  killmailTime: string | Date;
  itemTypeIds: number[];
}

/**
 * Worker that fetches market prices for items from a killmail
 * and stores them in the prices table
 */
export class PriceFetcher extends BaseWorker {
  queueName = "prices";

  async handle(
    payload: PriceFetchPayload,
    job: any
  ): Promise<void> {
    const { killmailId, killmailTime, itemTypeIds } = payload;

    if (!itemTypeIds || itemTypeIds.length === 0) {
      logger.debug(`[PriceFetcher] No items to fetch prices for (killmail ${killmailId})`);
      return;
    }

    // Parse killmail date
    const killDate = new Date(killmailTime);
    const killDateAtMidnight = new Date(killDate.getUTCFullYear(), killDate.getUTCMonth(), killDate.getUTCDate());

    logger.info(`[PriceFetcher] Fetching prices for killmail ${killmailId} (${killDateAtMidnight.toISOString()})`);

    const results = {
      fetched: 0,
      skipped: 0,
      errors: 0,
    };

    // Fetch prices for each item type
    for (const typeId of itemTypeIds) {
      try {
        // Check if we already have a price for this type on this date
        const existing = await db.query.prices.findFirst({
          where: and(
            eq(prices.typeId, typeId),
            eq(prices.date, killDateAtMidnight)
          ),
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Fetch price from EVE-KILL API (defaults to 14 days of history)
        const priceData = await priceService.getPriceForType(typeId);

        if (!priceData || priceData.length === 0) {
          logger.debug(`[PriceFetcher] No price data found for type ${typeId} from EVE-KILL API`);
          results.errors++;
          continue;
        }

        logger.debug(`[PriceFetcher] Got ${priceData.length} price entries for type ${typeId}`);

        // Find the entry closest to our killmail date
        let bestEntry = priceData[0]!;
        let bestDiff = Math.abs(new Date(priceData[0]!.date).getTime() - killDate.getTime());

        for (let i = 1; i < priceData.length; i++) {
          const diff = Math.abs(new Date(priceData[i]!.date).getTime() - killDate.getTime());
          if (diff < bestDiff) {
            bestDiff = diff;
            bestEntry = priceData[i]!;
          }
        }

        logger.debug(`[PriceFetcher] Best price for type ${typeId}: ${bestEntry.average} ISK (from ${bestEntry.date})`);

        // Store in database
        await db.insert(prices).values({
          typeId,
          date: killDateAtMidnight,
          average: bestEntry.average,
          highest: bestEntry.highest,
          lowest: bestEntry.lowest,
          orderCount: bestEntry.order_count,
          volume: bestEntry.volume,
        }).then(() => {
          logger.debug(`[PriceFetcher] Stored price for type ${typeId}`);
        }).catch((err) => {
          // Handle potential duplicate key constraint (race condition)
          if (err.message?.includes("UNIQUE constraint failed")) {
            logger.debug(`[PriceFetcher] Price already exists for type ${typeId} on ${killDateAtMidnight.toISOString()}`);
            results.skipped++;
          } else {
            throw err;
          }
        });

        results.fetched++;
      } catch (error) {
        logger.error(`[PriceFetcher] Error fetching price for type ${typeId}:`, error);
        results.errors++;
      }
    }

    logger.info(
      `[PriceFetcher] Completed for killmail ${killmailId}: ` +
      `${results.fetched} fetched, ${results.skipped} skipped, ${results.errors} errors`
    );
  }
}
