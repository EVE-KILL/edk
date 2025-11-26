import { ingestLatestWarsFirstPage } from '../server/fetchers/war';
import { logger } from '../server/helpers/logger';

export const name = 'fetch-latest-wars';
export const schedule = '0 15 3 * * *'; // Daily at 03:15 UTC
export const description =
  'Fetch the first page of wars daily and ingest any new wars.';

export const action = async () => {
  logger.info('[war] Starting daily latest wars sync');
  await ingestLatestWarsFirstPage();
  logger.info('[war] Completed daily latest wars sync');
};
