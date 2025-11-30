import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/prices:
 *   get:
 *     summary: Get prices list
 *     description: Returns a paginated list of prices, optionally filtered by region and type.
 *     tags:
 *       - Prices
 *     parameters:
 *       - name: regionId
 *         in: query
 *         description: Filter by region ID (default is Jita - 10000002)
 *         schema:
 *           type: integer
 *           default: 10000002
 *       - name: typeId
 *         in: query
 *         description: Filter by type ID
 *         schema:
 *           type: integer
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: perPage
 *         in: query
 *         description: Items per page (max 200)
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       '200':
 *         description: List of prices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       typeId:
 *                         type: integer
 *                       regionId:
 *                         type: integer
 *                       priceDate:
 *                         type: string
 *                         format: date-time
 *                       averagePrice:
 *                         type: number
 *                       highestPrice:
 *                         type: number
 *                       lowestPrice:
 *                         type: number
 *                       orderCount:
 *                         type: integer
 *                       volume:
 *                         type: string
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *             example:
 *               prices:
 *                 - typeId: 2303
 *                   regionId: 10000001
 *                   priceDate: "2025-11-26T00:00:00.000Z"
 *                   averagePrice: 3945000
 *                   highestPrice: 3945000
 *                   lowestPrice: 3945000
 *                   orderCount: 1
 *                   volume: "1"
 *               page: 1
 *               perPage: 50
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
