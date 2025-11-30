import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Mastery } from '~/models/masteries';

/**
 * @openapi
 * /api/sde/masteries/{id}:
 *   get:
 *     summary: Get mastery by ID
 *     description: Returns a single mastery from the Static Data Export.
 *     tags:
 *       - SDE - Skills
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The mastery ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Mastery details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Mastery not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The mastery ID'),
    }),
  });

  const item = await database.findOne<Mastery>(
    `SELECT * FROM masteries WHERE "typeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Mastery not found',
    });
  }

  return item;
});
