import { database } from '../server/helpers/database';

const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

export const name = 'refresh-kill-list';
export const description =
  '[DISABLED] kill_list is now a regular view, no refresh needed';
export const schedule = ''; // Disabled - kill_list is now a regular view, not materialized

export const action = async () => {
  // This cronjob is disabled because kill_list was converted from a materialized view
  // to a regular view to avoid storing 90M+ rows of denormalized data.
  // Regular views don't need to be refreshed - they query the base tables on demand.
  logger.info(
    'kill_list cronjob is disabled (kill_list is now a regular view)'
  );
};
