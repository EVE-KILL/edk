import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/prices/region/{id}:
 *   get:
 *     summary: Get paginated prices for a region
 *     description: Returns a paginated list of all item prices for a specific region, sorted by price date.
 *     tags:
 *       - Prices
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The region ID
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
 *         description: Paginated list of prices for the region
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
 *                         example: 20
 *                       regionId:
 *                         type: integer
 *                         example: 10000001
 *                       priceDate:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-11-25T00:00:00.000Z"
 *                       averagePrice:
 *                         type: number
 *                         example: 400
 *                       highestPrice:
 *                         type: number
 *                         example: 400
 *                       lowestPrice:
 *                         type: number
 *                         example: 400
 *                       orderCount:
 *                         type: integer
 *                         example: 1
 *                       volume:
 *                         type: string
 *                         example: "5270"
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 50
 */
export default defineEventHandler(async (event) => {
  const { params, query } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(200).default(50),
    }),
  });

  const { id } = params;
  const { page, perPage } = query;
  const offset = (page - 1) * perPage;
  const sql = database.sql;

  const prices = await sql`
    SELECT * FROM prices
    WHERE "regionId" = ${id}
    ORDER BY "priceDate"
    LIMIT ${perPage} OFFSET ${offset}
  `;

  return {
    prices,
    page,
    perPage,
  };
});
