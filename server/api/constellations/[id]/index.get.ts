import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/constellations/{id}:
 *   get:
 *     summary: Get constellation details
 *     description: Returns constellation information from the database.
 *     tags:
 *       - Constellations
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The constellation ID
 *         schema:
 *           type: integer
 *           example: 20000020
 *     responses:
 *       '200':
 *         description: Constellation details
 *       '404':
 *         description: Constellation not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const constellation = await database.findOne('"mapConstellations"', {
    constellationId: id,
  });

  if (!constellation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Constellation not found',
    });
  }

  return constellation;
});
