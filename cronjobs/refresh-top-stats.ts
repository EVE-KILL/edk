import { logger } from '../server/helpers/logger';

import { database } from '../server/helpers/database';

const logger = {
  info: (message: string) => logger.info(`[INFO] ${message}`),
  error: (message: string) => logger.error(`[ERROR] ${message}`),
};

export const name = 'refresh-top-stats';
export const description = 'Refreshes the top statistics materialized views';
export const schedule = '2,17,32,47 * * * *'; // Every 15 minutes, offset from kill_list to avoid lock contention

const TOP_VIEWS = [
  'top_characters_weekly',
  'top_corporations_weekly',
  'top_alliances_weekly',
  'top_systems_weekly',
  'top_regions_weekly',
];

export const action = async () => {
  try {
    logger.info('Refreshing top statistics materialized views...');
    for (const view of TOP_VIEWS) {
      await database.execute(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY ${database.identifier(view)}`
      );
    }
    logger.info('Finished refreshing top statistics materialized views.');
  } catch (error) {
    logger.error(
      `Failed to refresh top statistics views: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};
