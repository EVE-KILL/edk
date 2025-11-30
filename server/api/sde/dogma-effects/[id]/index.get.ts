import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { DogmaEffect } from '~/models/dogmaEffects';

/**
 * @openapi
 * /api/sde/dogma-effects/{id}:
 *   get:
 *     summary: Get dogma effect by ID
 *     description: Returns a single dogma effect from the Static Data Export.
 *     tags:
 *       - SDE - Dogma
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The dogma effect ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: DogmaEffect details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: DogmaEffect not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The dogma effect ID'),
    }),
  });

  const item = await database.findOne<DogmaEffect>(
    `SELECT * FROM dogmaeffects WHERE "effectId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DogmaEffect not found',
    });
  }

  return item;
});
