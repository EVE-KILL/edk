import { z } from 'zod';
import { validate } from '~/server/utils/validation';

/**
 * GET /api/killmail/{id}/esi
 *
 * Retrieves a killmail by ID in ESI format
 *
 * @param id - The killmail ID to fetch
 * @returns ESI formatted killmail data
 */
export default defineEventHandler(async (event: any) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const killmail = await getKillmail(id);

  if (!killmail) {
    throw createError({
      statusCode: 404,
      statusMessage: `Killmail with ID ${id} not found`,
    });
  }

  return killmail;
});
