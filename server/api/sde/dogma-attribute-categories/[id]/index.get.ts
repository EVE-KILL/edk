import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { DogmaAttributeCategory } from '~/models/dogmaAttributeCategories';

/**
 * @openapi
 * /api/sde/dogma-attribute-categories/{id}:
 *   get:
 *     summary: Get dogma attribute category by ID
 *     description: Returns a single dogma attribute category from the Static Data Export.
 *     tags:
 *       - SDE - Dogma
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The dogma attribute category ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: DogmaAttributeCategory details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: DogmaAttributeCategory not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The dogma attribute category ID'),
    }),
  });

  const item = await database.findOne<DogmaAttributeCategory>(
    `SELECT * FROM dogmaattributecategories WHERE "categoryId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DogmaAttributeCategory not found',
    });
  }

  return item;
});
