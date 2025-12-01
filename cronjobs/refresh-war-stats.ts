/**
 * Refresh War Statistics Materialized Views
 *
 * Periodically refreshes the war_stats, war_participants, war_ship_classes,
 * war_most_valuable_kills, and war_top_statistics materialized views to ensure
 * war statistics are up-to-date without expensive on-demand aggregations.
 *
 * Runs: Every hour at :05 past the hour
 */

import { spawn } from 'child_process';
import { logger } from '../server/helpers/logger';

export const name = 'refresh-war-stats';
export const description =
  'Refreshes war statistics materialized views (war_stats, war_participants, war_ship_classes, war_most_valuable_kills, war_top_statistics)';
export const schedule = '0 5 * * * *'; // Every hour at :05 past the hour

const WAR_MVS = [
  'war_stats',
  'war_participants',
  'war_ship_classes',
  'war_most_valuable_kills',
  'war_top_statistics',
];

export async function action() {
  logger.info('Starting war statistics materialized view refresh');

  try {
    const startTime = Date.now();

    // Refresh all war-related materialized views in parallel
    await Promise.all(WAR_MVS.map((viewName) => refreshView(viewName)));

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

function refreshView(viewName: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const child = spawn('bun', ['cli', 'db:refresh', viewName], {
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`db:refresh ${viewName} exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
