import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/factions/{id}:
 *   get:
 *     summary: Get faction details
 *     description: Returns faction information from the database.
 *     tags:
 *       - Factions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The faction ID
 *         schema:
 *           type: integer
 *           example: 500001
 *     responses:
 *       '200':
 *         description: Faction details
 *       '404':
 *         description: Faction not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const faction = await database.findOne('factions', { factionId: id });

  if (!faction) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Faction not found',
    });
  }

  return faction;
});
