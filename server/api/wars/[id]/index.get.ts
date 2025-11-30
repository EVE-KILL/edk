import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/wars/{id}:
 *   get:
 *     summary: Get war details
 *     description: Returns war information from the database.
 *     tags:
 *       - Wars
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The war ID
 *         schema:
 *           type: integer
 *           example: 615476
 *     responses:
 *       '200':
 *         description: War details
 *       '404':
 *         description: War not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const war = await database.findOne('wars', { warId: id });

  if (!war) {
    throw createError({
      statusCode: 404,
      statusMessage: 'War not found',
    });
  }

  return war;
});
