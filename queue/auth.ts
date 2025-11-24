import { Job, Worker } from 'bullmq';
import { logger } from '../server/helpers/logger';
import { getUserById, refreshUserTokens } from '../server/models/user-auth';

export const name = 'auth';

export async function processor(job: Job): Promise<void> {
  const { userId } = job.data as { userId: number };

  try {
    const user = await getUserById(userId);
    if (!user) {
      logger.warn('Auth queue: user not found', { userId });
      return;
    }

    const refreshed = await refreshUserTokens(user);
    if (refreshed) {
      logger.info('Refreshed EVE SSO token', {
        userId,
        characterId: refreshed.characterId,
      });
    }
  } catch (error) {
    logger.error('Auth queue failed to refresh token', {
      error: String(error),
      userId,
    });
    throw error;
  }
}

export function createWorker(
  connection: any,
  options?: { concurrency?: number }
) {
  return new Worker(name, processor, {
    connection,
    concurrency: options?.concurrency ?? 2,
    lockDuration: 30000,
    lockRenewTime: 15000,
    maxStalledCount: 2,
    stalledInterval: 5000,
  });
}
