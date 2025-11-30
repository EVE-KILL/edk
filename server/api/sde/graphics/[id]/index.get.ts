import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Graphic } from '~/models/graphics';

/**
 * @openapi
 * /api/sde/graphics/{id}:
 *   get:
 *     summary: Get graphic by ID
 *     description: Returns a single graphic from the Static Data Export.
 *     tags:
 *       - SDE - Cosmetics
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The graphic ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Graphic details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Graphic not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The graphic ID'),
    }),
  });

  const item = await database.findOne<Graphic>(
    `SELECT * FROM graphics WHERE "graphicId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Graphic not found',
    });
  }

  return item;
});
