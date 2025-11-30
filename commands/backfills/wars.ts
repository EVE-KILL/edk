import { logger } from '../../server/helpers/logger';
import { getConfig, setConfig, deleteConfig } from '../../server/models/config';
import { clearWars } from '../../server/models/wars';
import { fetchWarIds, ingestWar } from '../../server/fetchers/war';
import chalk from 'chalk';

const CONFIG_KEY = 'wars:lastBackfillPage';

export default {
  description: 'Backfill wars from ESI with resume support',
  options: [
    {
      flags: '--page <number>',
      description: 'Start from a specific page (overrides resume)',
    },
    {
      flags: '--resume',
      description: 'Resume from last stored page progress',
    },
    {
      flags: '--limit <number>',
      description: 'Maximum number of wars to process',
    },
    {
      flags: '--reset',
      description: 'Clear stored wars and resume marker before backfill',
    },
  ],
  action: async (options: {
    page?: string;
    resume?: boolean;
    limit?: string;
    reset?: boolean;
  }) => {
    if (options.reset) {
      await clearWars();
      await deleteConfig(CONFIG_KEY);
      logger.info('Reset wars data and progress marker');
    }

    const parsedLimit = options.limit
      ? Number.parseInt(options.limit, 10)
      : NaN;
    const limit = Number.isNaN(parsedLimit) ? Infinity : parsedLimit;
    let startPage = options.page ? Number.parseInt(options.page, 10) : 1;
    if (Number.isNaN(startPage)) {
      startPage = 1;
    }

    if (options.resume && !options.page) {
      const saved = await getConfig(CONFIG_KEY);
      if (saved) {
        const savedPage = Number.parseInt(saved, 10);
        startPage = Number.isNaN(savedPage) ? 1 : savedPage + 1;
        logger.info(`Resuming from page ${startPage}`);
      }
    }

    let processed = 0;
    let page = Math.max(1, startPage);
    const concurrency = 5; // Process 5 wars in parallel

    while (processed < limit) {
      const warIds = await fetchWarIds(page);
      if (warIds.length === 0) {
        logger.info(`No wars returned on page ${page}, stopping backfill`);
        break;
      }

      logger.info(`Processing page ${page} (${warIds.length} wars)`);

      // Process wars in batches with concurrency
      const warsToProcess = warIds.slice(
        0,
        Math.min(warIds.length, limit - processed)
      );

      // Split into chunks for parallel processing
      for (let i = 0; i < warsToProcess.length; i += concurrency) {
        const batch = warsToProcess.slice(i, i + concurrency);

        await Promise.all(
          batch.map(async (warId) => {
            try {
              const result = await ingestWar(warId);
              processed++;
              logger.success(
                `${chalk.green('➕')} added war ${chalk.cyan(
                  warId
                )} (${chalk.yellow('allies')} ${result.alliesCount}, ${chalk.yellow(
                  'km'
                )} +${result.queuedKillmails})`
              );
            } catch (error) {
              logger.error(`[war] Failed to ingest war ${warId}`, {
                error: String(error),
              });
            }
          })
        );
      }

      await setConfig(CONFIG_KEY, String(page));
      page++;
    }

    logger.info(
      `[war] Backfill complete. Processed ${processed} wars starting from page ${startPage}`
    );
  },
};
