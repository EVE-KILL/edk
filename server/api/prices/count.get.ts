import { z } from 'zod';
import { validate } from '~/utils/validation';
import { getApproximateCount } from '~/helpers/approximate-count';

/**
 * @openapi
 * /api/prices/count:
 *   get:
 *     summary: Get total price count
 *     description: Returns the total number of price entries in the database. If regionId is provided, returns count for that specific region.
 *     tags:
 *       - Prices
 *     parameters:
 *       - name: regionId
 *         in: query
 *         required: false
 *         description: If provided, returns count for prices in this specific region only
 *         schema:
 *           type: integer
 *           example: 10000001
 *     responses:
 *       '200':
 *         description: Total price count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - count
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 1234567
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
