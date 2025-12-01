import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/prices:
 *   get:
 *     summary: Get paginated price list
 *     description: Returns a paginated list of prices from market data, optionally filtered by region. Sorted by price date in descending order.
 *     tags:
 *       - Prices
 *     parameters:
 *       - name: regionId
 *         in: query
 *         required: false
 *         description: Filter by region ID (if not provided, returns prices from all regions)
 *         schema:
 *           type: integer
 *           example: 10000001
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number (1-indexed)
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - name: perPage
 *         in: query
 *         required: false
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       '200':
 *         description: Paginated list of prices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - prices
 *                 - page
 *                 - perPage
 *               properties:
 *                 prices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       typeId:
 *                         type: integer
 *                         example: 34
 *                       regionId:
 *                         type: integer
 *                         example: 10000001
 *                       priceDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-26T00:00:00.000Z"
 *                       averagePrice:
 *                         type: number
 *                         example: 0.99
 *                       highestPrice:
 *                         type: number
 *                         example: 2.65
 *                       lowestPrice:
 *                         type: number
 *                         example: 0.98
 *                       orderCount:
 *                         type: integer
 *                         example: 31
 *                       volume:
 *                         type: string
 *                         example: "66479257"
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 50
 */
export default defineEventHandler(async (event) => {
  const { query } = await validate(event, {
    query: z.object({
      regionId: z.coerce.number().int().positive().optional(),
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(200).default(50),
    }),
  });

  const { regionId, page, perPage } = query;
  const offset = (page - 1) * perPage;
  const sql = database.sql;

  let prices;
  if (regionId) {
    prices = await sql`
      SELECT * FROM prices
      WHERE "regionId" = ${regionId}
      ORDER BY "priceDate" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;
  } else {
    prices = await sql`
      SELECT * FROM prices
      ORDER BY "regionId", "priceDate" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;
  }

  return {
    prices,
    page,
    perPage,
  };
});
