import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { MarketGroup } from '~/models/marketGroups';

/**
 * @openapi
 * /api/sde/market-groups/{id}:
 *   get:
 *     summary: Get market group by ID
 *     description: Returns a single market group from the Static Data Export.
 *     tags:
 *       - SDE - Market
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The market group ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: MarketGroup details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: MarketGroup not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The market group ID'),
    }),
  });

  const item = await database.findOne<MarketGroup>(
    `SELECT * FROM marketgroups WHERE "marketGroupId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'MarketGroup not found',
    });
  }

  return item;
});
