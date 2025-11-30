import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/solarsystems/{id}:
 *   get:
 *     summary: Get solar system details
 *     description: Returns solar system information from the database.
 *     tags:
 *       - Solar Systems
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The solar system ID
 *         schema:
 *           type: integer
 *           example: 30000142
 *     responses:
 *       '200':
 *         description: Solar system details
 *       '404':
 *         description: Solar system not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const solarSystem = await database.findOne('"mapSolarSystems"', {
    solarSystemId: id,
  });

  if (!solarSystem) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Solar system not found',
    });
  }

  return solarSystem;
});
