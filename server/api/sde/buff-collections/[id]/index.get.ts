import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { DbuffCollection } from '~/models/dbuffCollections';

/**
 * @openapi
 * /api/sde/buff-collections/{id}:
 *   get:
 *     summary: Get buff collection by ID
 *     description: Returns a single buff collection from the Static Data Export.
 *     tags:
 *       - SDE - Miscellaneous
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The buff collection ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: DbuffCollection details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: DbuffCollection not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The buff collection ID'),
    }),
  });

  const item = await database.findOne<DbuffCollection>(
    `SELECT * FROM dbuffcollections WHERE "collectionId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DbuffCollection not found',
    });
  }

  return item;
});
