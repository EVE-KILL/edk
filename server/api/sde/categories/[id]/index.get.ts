import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Category } from '~/models/categories';

/**
 * @openapi
 * /api/sde/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     description: Returns a single category from the Static Data Export.
 *     tags:
 *       - SDE - Types
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The category ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Category details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Category not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The category ID'),
    }),
  });

  const item = await database.findOne<Category>(
    `SELECT * FROM categories WHERE "categoryId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Category not found',
    });
  }

  return item;
});
