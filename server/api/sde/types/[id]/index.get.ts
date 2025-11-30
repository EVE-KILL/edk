import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Type } from '~/models/types';

/**
 * @openapi
 * /api/sde/types/{id}:
 *   get:
 *     summary: Get type by ID
 *     description: Returns a single type from the Static Data Export.
 *     tags:
 *       - SDE - Types
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The type ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Type details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Type not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The type ID'),
    }),
  });

  const item = await database.findOne<Type>(
    `SELECT * FROM types WHERE "typeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Type not found',
    });
  }

  return item;
});
