import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/items:
 *   get:
 *     summary: Get item/type list
 *     description: Returns a paginated list of item types, optionally filtered by search term.
 *     tags:
 *       - Items
 *     parameters:
 *       - name: search
 *         in: query
 *         description: Search term to filter items
 *         schema:
 *           type: string
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
 *         description: List of items/types
 */
export default defineEventHandler(async (event) => {
  const { query } = await validate(event, {
    query: z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(200).default(50),
    }),
  });

  const { search, page, perPage } = query;
  const offset = (page - 1) * perPage;
  const sql = database.sql;

  let items;
  if (search) {
    items = await sql`
      SELECT * FROM types
      WHERE LOWER("typeName") LIKE ${`%${search.toLowerCase()}%`}
      ORDER BY "typeName"
      LIMIT ${perPage} OFFSET ${offset}
    `;
  } else {
    items = await sql`
      SELECT * FROM types
      WHERE published = true
      ORDER BY "typeId"
      LIMIT ${perPage} OFFSET ${offset}
    `;
  }

  return {
    items,
    page,
    perPage,
  };
});
