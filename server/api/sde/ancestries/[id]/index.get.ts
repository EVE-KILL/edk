import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Ancestry } from '~/models/ancestries';

/**
 * @openapi
 * /api/sde/ancestries/{id}:
 *   get:
 *     summary: Get ancestry by ID
 *     description: Returns a single ancestry from the Static Data Export.
 *     tags:
 *       - SDE - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ancestry ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Ancestry details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Ancestry not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The ancestry ID'),
    }),
  });

  const item = await database.findOne<Ancestry>(
    `SELECT * FROM ancestries WHERE "ancestryId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ancestry not found',
    });
  }

  return item;
});
