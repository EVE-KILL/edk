import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/prices/region/{id}:
 *   get:
 *     summary: Get prices for a region
 *     description: Returns all prices for items in a specific region.
 *     tags:
 *       - Prices
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The region ID
 *         schema:
 *           type: integer
 *           example: 10000002
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
 *         description: List of prices for the region
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
    ORDER BY "typeId"
    LIMIT ${perPage} OFFSET ${offset}
  `;

  return {
    prices,
    page,
    perPage,
  };
});
