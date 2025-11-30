import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/items/{id}:
 *   get:
 *     summary: Get item/type details
 *     description: Returns item type information from the database.
 *     tags:
 *       - Items
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The type ID
 *         schema:
 *           type: integer
 *           example: 587
 *     responses:
 *       '200':
 *         description: Item/type details
 *       '404':
 *         description: Item/type not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const type = await database.findOne('types', { typeId: id });

  if (!type) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Item/type not found',
    });
  }

  return type;
});
