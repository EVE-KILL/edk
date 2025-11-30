import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { MetaGroup } from '~/models/metaGroups';

/**
 * @openapi
 * /api/sde/meta-groups/{id}:
 *   get:
 *     summary: Get meta group by ID
 *     description: Returns a single meta group from the Static Data Export.
 *     tags:
 *       - SDE - Market
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The meta group ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: MetaGroup details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: MetaGroup not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The meta group ID'),
    }),
  });

  const item = await database.findOne<MetaGroup>(
    `SELECT * FROM metagroups WHERE "metaGroupId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'MetaGroup not found',
    });
  }

  return item;
});
