import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Icon } from '~/models/icons';

/**
 * @openapi
 * /api/sde/icons/{id}:
 *   get:
 *     summary: Get icon by ID
 *     description: Returns a single icon from the Static Data Export.
 *     tags:
 *       - SDE - Cosmetics
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The icon ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Icon details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Icon not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The icon ID'),
    }),
  });

  const item = await database.findOne<Icon>(
    `SELECT * FROM icons WHERE "iconId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Icon not found',
    });
  }

  return item;
});
