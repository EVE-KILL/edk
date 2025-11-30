import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Constellation } from '~/models/constellations';

/**
 * @openapi
 * /api/sde/constellations/{id}:
 *   get:
 *     summary: Get constellation by ID
 *     description: Returns a single constellation from the Static Data Export.
 *     tags:
 *       - SDE - Map
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The constellation ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Constellation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Constellation not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The constellation ID'),
    }),
  });

  const item = await database.findOne<Constellation>(
    `SELECT * FROM constellations WHERE "constellationId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Constellation not found',
    });
  }

  return item;
});
