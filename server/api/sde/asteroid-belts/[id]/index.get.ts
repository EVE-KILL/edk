import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { AsteroidBelt } from '~/models/asteroidBelts';

/**
 * @openapi
 * /api/sde/asteroid-belts/{id}:
 *   get:
 *     summary: Get asteroid belt by ID
 *     description: Returns a single asteroid belt from the Static Data Export.
 *     tags:
 *       - SDE - Map
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The asteroid belt ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: AsteroidBelt details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: AsteroidBelt not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The asteroid belt ID'),
    }),
  });

  const item = await database.findOne<AsteroidBelt>(
    `SELECT * FROM asteroidbelts WHERE "asteroidBeltId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'AsteroidBelt not found',
    });
  }

  return item;
});
