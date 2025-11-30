import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { SolarSystem } from '~/models/solarSystems';

/**
 * @openapi
 * /api/sde/solar-systems/{id}:
 *   get:
 *     summary: Get solar system by ID
 *     description: Returns a single solar system from the Static Data Export.
 *     tags:
 *       - SDE - Map
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The solar system ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: SolarSystem details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: SolarSystem not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The solar system ID'),
    }),
  });

  const item = await database.findOne<SolarSystem>(
    `SELECT * FROM solarsystems WHERE "solarSystemId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'SolarSystem not found',
    });
  }

  return item;
});
