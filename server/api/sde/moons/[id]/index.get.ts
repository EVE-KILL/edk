import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Moon } from '~/models/moons';

/**
 * @openapi
 * /api/sde/moons/{id}:
 *   get:
 *     summary: Get moon by ID
 *     description: Returns a single moon from the Static Data Export.
 *     tags:
 *       - SDE - Map
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The moon ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Moon details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Moon not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The moon ID'),
    }),
  });

  const item = await database.findOne<Moon>(
    `SELECT * FROM moons WHERE "moonId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Moon not found',
    });
  }

  return item;
});
