import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Planet } from '~/models/planets';

/**
 * @openapi
 * /api/sde/planets/{id}:
 *   get:
 *     summary: Get planet by ID
 *     description: Returns a single planet from the Static Data Export.
 *     tags:
 *       - SDE - Map
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The planet ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Planet details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Planet not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The planet ID'),
    }),
  });

  const item = await database.findOne<Planet>(
    `SELECT * FROM planets WHERE "planetId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Planet not found',
    });
  }

  return item;
});
