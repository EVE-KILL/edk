import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Star } from '~/models/stars';

/**
 * @openapi
 * /api/sde/stars/{id}:
 *   get:
 *     summary: Get star by ID
 *     description: Returns a single star from the Static Data Export.
 *     tags:
 *       - SDE - Map
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The star ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Star details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Star not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The star ID'),
    }),
  });

  const item = await database.findOne<Star>(
    `SELECT * FROM stars WHERE "starId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Star not found',
    });
  }

  return item;
});
