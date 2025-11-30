import { z } from 'zod';
import { validate } from '~/utils/validation';
import { getApproximateCount } from '~/helpers/approximate-count';

/**
 * @openapi
 * /api/prices/count:
 *   get:
 *     summary: Get total price count
 *     description: Returns the total number of price entries in the database.
 *     tags:
 *       - Prices
 *     parameters:
 *       - name: regionId
 *         in: query
 *         description: Filter by region ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Total price count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 12345
 */
export default defineEventHandler(async (event) => {
  const { query } = await validate(event, {
    query: z.object({
      regionId: z.coerce.number().int().positive().optional(),
    }),
  });

  const { regionId } = query;

  let count;
  if (regionId) {
    const result = await database.findOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM prices WHERE "regionId" = :regionId',
      { regionId }
    );
    count = result?.count || 0;
  } else {
    count = await getApproximateCount('prices');
  }

  return {
    count,
  };
});
