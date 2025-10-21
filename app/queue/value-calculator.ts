import { BaseWorker } from "../../src/queue/base-worker";
import type { Job } from "../../db/schema/jobs";
import { logger } from "../../src/utils/logger";
import { db } from "../../src/db";
import { killmails, items, prices } from "../../db/schema";
import { eq } from "drizzle-orm";

/**
 * Value Calculator Worker
 *
 * Calculates the total ISK value for killmails by:
 * 1. Fetching all items for the killmail
 * 2. Looking up prices for each item (closest to killmail date)
 * 3. Calculating: SUM(quantity * average_price)
 * 4. Updating killmails.total_value
 */
export class ValueCalculator extends BaseWorker<{
  killmailDbId: number;
  killmailTime: Date;
}> {
  override queueName = "value";
  override concurrency = 10; // Calculate 10 at once
  override pollInterval = 1000;

  override async handle(
    payload: { killmailDbId: number; killmailTime: Date },
    job: Job
  ) {
    const { killmailDbId, killmailTime } = payload;

    try {
      // Fetch all items for this killmail
      const killmailItems = await db
        .select()
        .from(items)
        .where(eq(items.killmailId, killmailDbId));

      if (killmailItems.length === 0) {
        logger.debug(`  ↳ Killmail ${killmailDbId} has no items, setting value to 0`);
        await this.updateKillmailValue(killmailDbId, "0");
        return;
      }

      // Get unique item type IDs
      const itemTypeIds = [
        ...new Set(killmailItems.map((item) => item.itemTypeId)),
      ];

      // Fetch prices for all item types closest to killmail time
      const priceMap = await this.getPricesForItems(itemTypeIds, killmailTime);

      // Calculate total value
      let totalValue = 0;
      for (const item of killmailItems) {
        const price = priceMap.get(item.itemTypeId);
        if (price) {
          totalValue += item.quantity * price.average;
        }
      }

      // Update killmail with calculated value
      await this.updateKillmailValue(killmailDbId, totalValue.toFixed(2));

      logger.debug(
        `  ↳ Calculated value for killmail ${killmailDbId}: ${totalValue.toFixed(2)} ISK`
      );
    } catch (error) {
      logger.error(`  ↳ Failed to calculate value for killmail ${killmailDbId}:`, error);
      throw error;
    }
  }

  /**
   * Get prices for items, finding the closest date to the killmail time
   */
  private async getPricesForItems(
    typeIds: number[],
    targetDate: Date
  ): Promise<Map<number, { average: number; highest: number; lowest: number }>> {
    if (typeIds.length === 0) {
      return new Map();
    }

    const priceMap = new Map<
      number,
      { average: number; highest: number; lowest: number }
    >();

    for (const typeId of typeIds) {
      const priceRecords = await db
        .select()
        .from(prices)
        .where(eq(prices.typeId, typeId));

      // Find the closest price record to the target date
      if (priceRecords.length > 0) {
        let closestRecord: (typeof priceRecords)[0] | undefined = priceRecords[0];
        let minDiff =
          closestRecord && closestRecord.date
            ? Math.abs(
                new Date(closestRecord.date).getTime() - targetDate.getTime()
              )
            : Infinity;

        for (const record of priceRecords) {
          if (!record.date) continue;
          const diff = Math.abs(
            new Date(record.date).getTime() - targetDate.getTime()
          );
          if (diff < minDiff) {
            minDiff = diff;
            closestRecord = record;
          }
        }

        if (closestRecord && closestRecord.date) {
          priceMap.set(typeId, {
            average: closestRecord.average || 0,
            highest: closestRecord.highest || 0,
            lowest: closestRecord.lowest || 0,
          });
        }
      }
    }

    return priceMap;
  }

  /**
   * Update the killmail's total value in the database
   */
  private async updateKillmailValue(
    killmailDbId: number,
    totalValue: string
  ): Promise<void> {
    await db
      .update(killmails)
      .set({
        totalValue,
        updatedAt: new Date(),
      })
      .where(eq(killmails.id, killmailDbId));
  }
}
