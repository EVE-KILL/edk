/**
 * Refresh War Top Statistics Materialized View
 *
 * Refreshes the 'war_top_statistics' materialized view.
 * This view is separated from the hourly refresh because it includes
 * massive calculations for faction wars (Caldari/Gallente, Amarr/Minmatar)
 * which can take a significant amount of time to compute.
 *
 * Runs: Every day at 03:05 UTC
 */

import { spawn } from 'child_process';
import { logger } from '../server/helpers/logger';

export const name = 'refresh-war-top-stats';
export const description =
  'Refreshes the heavy war_top_statistics materialized view daily';
export const schedule = '0 5 3 * * *'; // Daily at 03:05

const VIEW_NAME = 'war_top_statistics_faction';

export async function action() {
  logger.info(`Starting ${VIEW_NAME} materialized view refresh`);

  try {
    const startTime = Date.now();

    await refreshView(VIEW_NAME);

    const duration = Date.now() - startTime;
    logger.success(
      `${VIEW_NAME} materialized view refreshed successfully in ${duration}ms`
    );
  } catch (error) {
    logger.error(`Failed to refresh ${VIEW_NAME} materialized view`, {
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
