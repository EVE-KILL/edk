import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { DynamicItemAttribute } from '~/models/dynamicItemAttributes';

/**
 * @openapi
 * /api/sde/dynamic-item-attributes/{id}:
 *   get:
 *     summary: Get dynamic item attribute by ID
 *     description: Returns a single dynamic item attribute from the Static Data Export.
 *     tags:
 *       - SDE - Miscellaneous
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The dynamic item attribute ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: DynamicItemAttribute details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: DynamicItemAttribute not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The dynamic item attribute ID'),
    }),
  });

  const item = await database.findOne<DynamicItemAttribute>(
    `SELECT * FROM dynamicitemattributes WHERE "typeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DynamicItemAttribute not found',
    });
  }

  return item;
});
