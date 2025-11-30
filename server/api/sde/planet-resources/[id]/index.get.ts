import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { PlanetResource } from '~/models/planetResources';

/**
 * @openapi
 * /api/sde/planet-resources/{id}:
 *   get:
 *     summary: Get planet resource by ID
 *     description: Returns a single planet resource from the Static Data Export.
 *     tags:
 *       - SDE - Planetary
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The planet resource ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: PlanetResource details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: PlanetResource not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The planet resource ID'),
    }),
  });

  const item = await database.findOne<PlanetResource>(
    `SELECT * FROM planetresources WHERE "planetId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'PlanetResource not found',
    });
  }

  return item;
});
