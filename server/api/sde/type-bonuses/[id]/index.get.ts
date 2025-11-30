import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { TypeBonus } from '~/models/typeBonuses';

/**
 * @openapi
 * /api/sde/type-bonuses/{id}:
 *   get:
 *     summary: Get type bonus by ID
 *     description: Returns a single type bonus from the Static Data Export.
 *     tags:
 *       - SDE - Skills
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The type bonus ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: TypeBonus details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: TypeBonus not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The type bonus ID'),
    }),
  });

  const item = await database.findOne<TypeBonus>(
    `SELECT * FROM typebonuses WHERE "typeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'TypeBonus not found',
    });
  }

  return item;
});
