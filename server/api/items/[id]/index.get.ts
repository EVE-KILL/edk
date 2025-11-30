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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               typeId: 587
 *               groupId: 419
 *               name: "Rifter"
 *               description: "The Rifter is a versatile frigate designed for high-speed combat operations."
 *               mass: 1067000
 *               volume: 27289
 *               capacity: 140
 *               portionSize: 1
 *               published: true
 *               marketGroupId: 378
 *               iconId: 3330
 *       '404':
 *         description: Item/type not found
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 404
 *               statusMessage: "Item/type not found"
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
