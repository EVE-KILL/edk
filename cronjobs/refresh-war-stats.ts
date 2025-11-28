/**
 * Refresh War Statistics Materialized Views
 *
 * Periodically refreshes the war_stats, war_participants, and war_ship_classes
 * materialized views to ensure war statistics are up-to-date without expensive
 * on-demand aggregations.
 *
 * Runs: Every hour at :05 past the hour
 */

import { logger } from '../server/helpers/logger';
import { refreshWarStats } from '../server/models/war-stats';

export const name = 'refresh-war-stats';
export const description =
  'Refreshes war statistics materialized views (war_stats, war_participants, war_ship_classes, war_most_valuable_kills)';
export const schedule = '0 5 * * * *'; // Every hour at :05 past the hour

export async function action() {
  logger.info('Starting war statistics materialized view refresh');

  try {
    const startTime = Date.now();

    await refreshWarStats();

    const duration = Date.now() - startTime;
    logger.success(
      `War statistics materialized views refreshed successfully in ${duration}ms`
    );
  } catch (error) {
    logger.error('Failed to refresh war statistics materialized views', {
      error,
    });
    throw error;
  }
}
