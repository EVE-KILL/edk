import { database } from '../server/helpers/database';
import { env } from '../server/helpers/env';
import { logger } from '../server/helpers/logger';
import { enqueueJob, JobPriority, QueueType } from '../server/helpers/queue';

export const name = 'refresh-sso-tokens';
export const description =
  'Queues refresh jobs for EVE SSO tokens that are close to expiring';
export const schedule = '0 */5 * * * *'; // Every 5 minutes

export async function action() {
  if (env.NODE_ENV === 'test') return;

  const users = await database.find<{ id: number }>(
    `SELECT "id"
     FROM users
     WHERE "tokenExpiresAt" <= NOW() + INTERVAL '15 minutes'
       AND "refreshToken" IS NOT NULL
     ORDER BY "tokenExpiresAt" ASC
     LIMIT 200`
  );

  if (!users.length) {
    logger.debug('No expiring SSO tokens found for refresh');
    return;
  }

  logger.info('Queueing token refresh jobs', { count: users.length });

  for (const user of users) {
    await enqueueJob(
      QueueType.AUTH,
      { userId: Number(user.id) },
      { priority: JobPriority.HIGH }
    );
  }
}
