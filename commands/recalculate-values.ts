/**
 * Recalculate killmail values
 * Recalculates totalValue from the items table (which has flat structure without double-counting)
 */

import { database } from '../server/helpers/database';
import { logger } from '../server/helpers/logger';
import { getLatestPricesForTypes } from '../server/models/prices';

interface Options {
  limit?: number;
  dryRun?: boolean;
  killmailId?: number;
  batchSize?: number;
}

export const description = 'Recalculate killmail values from items table';

export const options = [
  {
    flags: '-l, --limit <number>',
    description: 'Limit number of killmails to process (default: 10000)',
  },
  {
    flags: '-d, --dry-run',
    description: 'Dry run - show what would be changed without updating',
  },
  {
    flags: '-k, --killmail-id <number>',
    description: 'Recalculate specific killmail ID',
  },
  {
    flags: '-b, --batch-size <number>',
    description: 'Batch size for processing (default: 100)',
  },
];

const PRICE_REGION_ID = 10000002; // The Forge

export async function action(options: Options) {
  const limit = options.limit ? Number.parseInt(options.limit.toString()) : 10000;
  const dryRun = options.dryRun ?? false;
  const batchSize = options.batchSize ? Number.parseInt(options.batchSize.toString()) : 100;
  const killmailId = options.killmailId
    ? Number.parseInt(options.killmailId.toString())
    : null;

  logger.info(
    `Recalculating killmail values ${dryRun ? '(DRY RUN)' : ''}...`
  );

  try {
    let killmails: Array<{ killmailId: number; victimShipTypeId: number; killmailTime: string; totalValue: number }>;

    if (killmailId) {
      // Recalculate specific killmail
      killmails = await database.sql<Array<{ killmailId: number; victimShipTypeId: number; killmailTime: string; totalValue: number }>>`
        SELECT "killmailId", "victimShipTypeId", "killmailTime", "totalValue"
        FROM killmails
        WHERE "killmailId" = ${killmailId}
      `;
    } else {
      // Recalculate killmails with high values (likely affected by double-counting bug)
      // Also include recent killmails to ensure new ones are correct
      killmails = await database.sql<Array<{ killmailId: number; victimShipTypeId: number; killmailTime: string; totalValue: number }>>`
        SELECT "killmailId", "victimShipTypeId", "killmailTime", "totalValue"
        FROM killmails
        WHERE "totalValue" > 50000000000
           OR "killmailTime" >= NOW() - INTERVAL '7 days'
        ORDER BY "totalValue" DESC
        LIMIT ${limit}
      `;
    }

    logger.info(`Found ${killmails.length} killmails to recalculate`);

    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < killmails.length; i += batchSize) {
      const batch = killmails.slice(i, Math.min(i + batchSize, killmails.length));
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(killmails.length / batchSize)}...`);

      for (const km of batch) {
        try {
          // Get all items for this killmail
          const items = await database.sql<Array<{
            itemTypeId: number;
            quantityDropped: number;
            quantityDestroyed: number;
          }>>`
            SELECT "itemTypeId", "quantityDropped", "quantityDestroyed"
            FROM items
            WHERE "killmailId" = ${km.killmailId}
          `;

          // Collect all type IDs (ship + items)
          const typeIds = new Set<number>();
          typeIds.add(km.victimShipTypeId);
          for (const item of items) {
            typeIds.add(item.itemTypeId);
          }

          // Get prices
          const priceMap = await getLatestPricesForTypes(
            Array.from(typeIds),
            PRICE_REGION_ID,
            km.killmailTime
          );

          // Calculate values
          const shipValue = priceMap.get(km.victimShipTypeId) ?? 0;
          let itemValue = 0;

          for (const item of items) {
            const price = priceMap.get(item.itemTypeId) ?? 0;
            const totalQty = (item.quantityDropped ?? 0) + (item.quantityDestroyed ?? 0);
            itemValue += price * totalQty;
          }

          const newValue = shipValue + itemValue;
          const oldValue = km.totalValue;
          const difference = oldValue - newValue;
          const percentChange = oldValue > 0 ? ((difference / oldValue) * 100).toFixed(2) : '0.00';

          if (Math.abs(difference) > 1000000) {
            // Significant change (>1m ISK)
            logger.info(
              `Killmail ${km.killmailId}: ${(oldValue / 1e9).toFixed(2)}b → ${(newValue / 1e9).toFixed(2)}b (${percentChange}% change)`
            );

            if (!dryRun) {
              await database.sql`
                UPDATE killmails
                SET "totalValue" = ${newValue}
                WHERE "killmailId" = ${km.killmailId}
              `;
            }

            updated++;
          } else {
            unchanged++;
          }
        } catch (error) {
          logger.error(`Error processing killmail ${km.killmailId}:`, error);
          errors++;
        }
      }
    }

    logger.success(
      `Recalculation complete: ${updated} updated, ${unchanged} unchanged, ${errors} errors`
    );

    if (dryRun) {
      logger.info('DRY RUN - No changes were made to the database');
    }
  } catch (error) {
    logger.error('Error recalculating values:', error);
    throw error;
  } finally {
    await database.close();
  }
}
