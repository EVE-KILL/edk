import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Landmark } from '~/models/landmarks';

/**
 * @openapi
 * /api/sde/landmarks/{id}:
 *   get:
 *     summary: Get landmark by ID
 *     description: Returns a single landmark from the Static Data Export.
 *     tags:
 *       - SDE - Miscellaneous
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The landmark ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Landmark details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Landmark not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The landmark ID'),
    }),
  });

  const item = await database.findOne<Landmark>(
    `SELECT * FROM landmarks WHERE "landmarkId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Landmark not found',
    });
  }

  return item;
});
