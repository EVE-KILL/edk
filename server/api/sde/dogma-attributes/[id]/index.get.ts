import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { DogmaAttribute } from '~/models/dogmaAttributes';

/**
 * @openapi
 * /api/sde/dogma-attributes/{id}:
 *   get:
 *     summary: Get dogma attribute by ID
 *     description: Returns a single dogma attribute from the Static Data Export.
 *     tags:
 *       - SDE - Dogma
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The dogma attribute ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: DogmaAttribute details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: DogmaAttribute not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The dogma attribute ID'),
    }),
  });

  const item = await database.findOne<DogmaAttribute>(
    `SELECT * FROM dogmaattributes WHERE "attributeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DogmaAttribute not found',
    });
  }

  return item;
});
