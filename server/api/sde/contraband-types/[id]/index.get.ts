import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { ContrabandType } from '~/models/contrabandTypes';

/**
 * @openapi
 * /api/sde/contraband-types/{id}:
 *   get:
 *     summary: Get contraband type by ID
 *     description: Returns a single contraband type from the Static Data Export.
 *     tags:
 *       - SDE - Miscellaneous
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The contraband type ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: ContrabandType details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: ContrabandType not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The contraband type ID'),
    }),
  });

  const item = await database.findOne<ContrabandType>(
    `SELECT * FROM contrabandtypes WHERE "typeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'ContrabandType not found',
    });
  }

  return item;
});
