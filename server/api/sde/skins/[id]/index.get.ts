import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Skin } from '~/models/skins';

/**
 * @openapi
 * /api/sde/skins/{id}:
 *   get:
 *     summary: Get skin by ID
 *     description: Returns a single skin from the Static Data Export.
 *     tags:
 *       - SDE - Cosmetics
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The skin ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Skin details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Skin not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The skin ID'),
    }),
  });

  const item = await database.findOne<Skin>(
    `SELECT * FROM skins WHERE "skinId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Skin not found',
    });
  }

  return item;
});
