import { logger } from '../server/helpers/logger';
import { spawn } from 'child_process';

async function updateRecentPrices(): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info('Spawning CLI process to update recent prices...');

    const cliProcess = spawn('bun', [
      'run',
      'cli.ts',
      'backfills:Prices',
      '--limit',
      '14',
    ]);

    cliProcess.stdout.on('data', (data) => {
      logger.info(`CLI_OUTPUT: ${data.toString().trim()}`);
    });

    cliProcess.stderr.on('data', (data) => {
      logger.error(`CLI_ERROR: ${data.toString().trim()}`);
    });

    cliProcess.on('close', (code) => {
      if (code === 0) {
        logger.info('CLI process completed successfully.');
        resolve();
      } else {
        logger.error(`CLI process exited with code ${code}`);
        reject(new Error(`CLI process failed with code ${code}`));
      }
    });

    cliProcess.on('error', (err) => {
      logger.error('Failed to start CLI process.', { error: err });
      reject(err);
    });
  });
}

export const name = 'update-prices';
export const schedule = '0 0 * * *'; // Runs every day at midnight UTC
export const description =
  'Updates the last 14 days of price data from EVERef.';
export const action = async () => {
  logger.info('Starting daily price update cronjob...');
  await updateRecentPrices();
  logger.info('Daily price update cronjob finished.');
};
