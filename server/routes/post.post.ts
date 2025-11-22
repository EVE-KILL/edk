import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { H3Event } from 'h3';
import { fetchAndStoreKillmail } from '../fetchers/killmail';
import { enqueueJobMany, QueueType } from '../helpers/queue';

export default defineEventHandler(async (event: H3Event) => {
  const { body } = await validate(event, {
    body: z.object({
      data: z
        .string()
        .url()
        .refine((val) => /killmails\/\d+\/[a-zA-Z0-9]+/.test(val), {
          message: 'Invalid ESI URL format',
        }),
    }),
  });

  const { data } = body;

  // Extract ID and Hash
  const match = data.match(/killmails\/(\d+)\/([a-zA-Z0-9]+)/);
  if (!match) {
    // This should not happen due to the regex refine in the validation schema
    return { error: 'Invalid ESI URL format' };
  }

  const killmailId = parseInt(match[1]);
  const hash = match[2];

  try {
    const result = await fetchAndStoreKillmail(killmailId, hash);

    if (!result) {
      return {
        error:
          'Failed to fetch or store killmail. It might be invalid, already exists, or ESI is down.',
      };
    }

    // Trigger background processing for entities (names, stats, etc)
    if (result.characterIds.length > 0) {
      await enqueueJobMany(
        QueueType.CHARACTER,
        result.characterIds.map((id) => ({ id }))
      );
    }
    if (result.corporationIds.length > 0) {
      await enqueueJobMany(
        QueueType.CORPORATION,
        result.corporationIds.map((id) => ({ id }))
      );
    }
    if (result.allianceIds.length > 0) {
      await enqueueJobMany(
        QueueType.ALLIANCE,
        result.allianceIds.map((id) => ({ id }))
      );
    }
    // Prices queue could be added if needed, but typically price fetcher runs periodically or on insert
    if (result.typeIds.length > 0) {
      // await enqueueJobMany(QueueType.PRICE, result.typeIds.map(id => ({ typeId: id })))
    }

    return {
      success: true,
      url: `/killmail/${killmailId}`,
    };
  } catch (e: any) {
    return { error: e.message || 'Server error' };
  }
});
