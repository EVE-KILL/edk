import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/prices:
 *   get:
 *     summary: Get price list
 *     description: Returns a paginated list of market prices.
 *     tags:
 *       - Prices
 *     parameters:
 *       - name: regionId
 *         in: query
 *         description: Filter by region ID
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
