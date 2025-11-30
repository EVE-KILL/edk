import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Race } from '~/models/races';

/**
 * @openapi
 * /api/sde/races/{id}:
 *   get:
 *     summary: Get race by ID
 *     description: Returns a single race from the Static Data Export.
 *     tags:
 *       - SDE - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The race ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Race details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Race not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The race ID'),
    }),
  });

  const item = await database.findOne<Race>(
    `SELECT * FROM races WHERE "raceId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Race not found',
    });
  }

  return item;
});
