import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { CharacterAttribute } from '~/models/characterAttributes';

/**
 * @openapi
 * /api/sde/character-attributes/{id}:
 *   get:
 *     summary: Get character attribute by ID
 *     description: Returns a single character attribute from the Static Data Export.
 *     tags:
 *       - SDE - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The character attribute ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: CharacterAttribute details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: CharacterAttribute not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The character attribute ID'),
    }),
  });

  const item = await database.findOne<CharacterAttribute>(
    `SELECT * FROM characterattributes WHERE "attributeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'CharacterAttribute not found',
    });
  }

  return item;
});
