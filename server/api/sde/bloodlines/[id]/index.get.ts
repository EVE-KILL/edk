import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Bloodline } from '~/models/bloodlines';

/**
 * @openapi
 * /api/sde/bloodlines/{id}:
 *   get:
 *     summary: Get bloodline by ID
 *     description: Returns a single bloodline from the Static Data Export.
 *     tags:
 *       - SDE - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The bloodline ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Bloodline details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Bloodline not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The bloodline ID'),
    }),
  });

  const item = await database.findOne<Bloodline>(
    `SELECT * FROM bloodlines WHERE "bloodlineId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Bloodline not found',
    });
  }

  return item;
});
