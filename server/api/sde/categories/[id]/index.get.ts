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
 *       - SDE - Categories
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The category ID
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       '200':
 *         description: Category details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - categoryId
 *                 - name
 *                 - published
 *               properties:
 *                 categoryId:
 *                   type: integer
 *                   description: Unique category identifier
 *                 name:
 *                   type: string
 *                   description: Category name
 *                 iconId:
 *                   type: [integer, 'null']
 *                   description: Icon ID
 *                 published:
 *                   type: boolean
 *                   description: Whether category is published
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
