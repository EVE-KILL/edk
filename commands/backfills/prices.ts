import csvParser from 'csv-parser';
import { Readable } from 'node:stream';
import bz2 from 'unbzip2-stream';
import { database } from '../../server/helpers/database';
import { logger } from '../../server/helpers/logger';
import { getConfig, setConfig } from '../../server/models/config';

const CONFIG_KEY = 'prices_backfill_last_date';
const EARLIEST_DATE = '2007-12-05';

export default {
  description:
    'Backfill prices from EVERef (newest to oldest, tracks progress)',
  options: [
    {
      flags: '--start-date <date>',
      description:
        'Start date in YYYY-MM-DD format (defaults to where we left off or today)',
    },
    {
      flags: '--end-date <date>',
      description: 'End date in YYYY-MM-DD format (defaults to 2007-12-05)',
    },
    {
      flags: '--limit <days>',
      description: 'Limit the number of days to process',
    },
    {
      flags: '--reset',
      description: 'Reset progress and start from today',
    },
  ],
  action: async (options: {
    startDate?: string;
    endDate?: string;
    limit?: string;
    reset?: boolean;
  }) => {
    logger.info('Starting price backfill (newest to oldest)...');

    // Handle reset
    if (options.reset) {
      await setConfig(CONFIG_KEY, new Date().toISOString().split('T')[0]);
      logger.info('Reset progress to today');
    }

    // Get last processed date from config
    const lastProcessedDate = await getConfig(CONFIG_KEY);

    // Determine start date (newest)
    let startDate: Date;
    if (options.startDate) {
      startDate = new Date(options.startDate);
    } else if (lastProcessedDate) {
      // Continue from where we left off (one day before last processed)
      startDate = new Date(lastProcessedDate);
      startDate.setDate(startDate.getDate() - 1);
      logger.info(
        `Resuming from ${startDate.toISOString().split('T')[0]} (last processed: ${lastProcessedDate})`
      );
    } else {
      // First run - start from today
      startDate = new Date();
      logger.info('First run - starting from today');
    }

    // Determine end date (oldest)
    const endDate = options.endDate
      ? new Date(options.endDate)
      : new Date(EARLIEST_DATE);

    // Apply limit if specified
    let actualEndDate = endDate;
    if (options.limit) {
      const limitDays = parseInt(options.limit, 10);
      actualEndDate = new Date(startDate);
      actualEndDate.setDate(startDate.getDate() - (limitDays - 1));

      // Don't go before the earliest date
      if (actualEndDate < endDate) {
        actualEndDate = endDate;
      }
    }

    const daysDifference = Math.floor(
      (startDate.getTime() - actualEndDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    logger.info(
      `Processing prices from ${startDate.toISOString().split('T')[0]} to ${actualEndDate.toISOString().split('T')[0]} (${daysDifference + 1} days).`
    );

    // Process from newest to oldest
    for (let i = 0; i <= daysDifference; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      await processDate(dateString);

      // Update progress after each successful day
      await setConfig(CONFIG_KEY, dateString);
    }

    logger.success('Price backfill complete.');
  },
};

async function processDate(date: string) {
  try {
    const year = date.split('-')[0];
    const url = `https://data.everef.net/market-history/${year}/market-history-${date}.csv.bz2`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        logger.warn(`No data available for ${date}`);
      } else {
        logger.error(
          `Failed to fetch data for ${date}: ${response.status} ${response.statusText}`
        );
      }
      return;
    }

    logger.info(`Processing market history for ${date}...`);

    const nodeStream = Readable.fromWeb(response.body as any);

    await new Promise<void>((resolve, reject) => {
      let insertCount = 0;

      const decompressedStream = nodeStream.pipe(bz2());
      const csvStream = decompressedStream.pipe(csvParser());

      const batchSize = 5000;
      let batch: any[] = [];

      const processBatch = async () => {
        if (batch.length === 0) return;

        try {
          await database.sql`
                INSERT INTO prices ${database.sql(batch)}
                ON CONFLICT ("typeId", "regionId", "priceDate")
                DO UPDATE SET
                    "averagePrice" = excluded."averagePrice",
                    "highestPrice" = excluded."highestPrice",
                    "lowestPrice" = excluded."lowestPrice",
                    "orderCount" = excluded."orderCount",
                    "volume" = excluded."volume"
            `;
          insertCount += batch.length;
        } catch (error) {
          logger.error(`Error inserting batch for ${date}:`, { error });
        } finally {
          batch = [];
        }
      };

      csvStream
        .on('data', (data) => {
          const record = generateRecord(data);
          if (record) {
            batch.push(record);
          }
          if (batch.length >= batchSize) {
            csvStream.pause();
            processBatch().then(() => {
              csvStream.resume();
            });
          }
        })
        .on('end', async () => {
          logger.info(`Inserted/updated ${insertCount} prices for ${date}`);
          resolve();
        })
        .on('error', (error) => {
          logger.error(`Error processing CSV for ${date}:`, { error });
          reject(error);
        });
    });
  } catch (error) {
    logger.error(`Error processing date ${date}:`, { error });
  }
}

function generateRecord(data: any): Record<string, any> | null {
  try {
    return {
      typeId: parseInt(data.type_id, 10),
      regionId: parseInt(data.region_id, 10),
      priceDate: data.date,
      averagePrice: parseFloat(data.average),
      highestPrice: parseFloat(data.highest),
      lowestPrice: parseFloat(data.lowest),
      orderCount: data.order_count ? parseInt(data.order_count, 10) : 0,
      volume: data.volume ? BigInt(data.volume) : BigInt(0),
    };
  } catch (e) {
    logger.warn('Skipping invalid record:', { data });
    return null;
  }
}
