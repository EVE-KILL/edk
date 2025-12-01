import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/items:
 *   get:
 *     summary: Get paginated item/type list
 *     description: Returns a paginated list of published item types, optionally filtered by search term. Sorted by type ID when no search term is provided.
 *     tags:
 *       - Items
 *     parameters:
 *       - name: search
 *         in: query
 *         required: false
 *         description: Search term to filter items by name (case-insensitive)
 *         schema:
 *           type: string
 *           example: "Plagioclase"
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
 *         description: Paginated list of items/types
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - items
 *                 - page
 *                 - perPage
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       typeId:
 *                         type: integer
 *                         example: 18
 *                       name:
 *                         type: string
 *                         example: "Plagioclase"
 *                       description:
 *                         type: string
 *                         example: "Plagioclase is not amongst the most valuable ore types..."
 *                       groupId:
 *                         type: integer
 *                         example: 458
 *                       capacity:
 *                         type: [number, "null"]
 *                         example: null
 *                       factionId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       graphicId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       iconId:
 *                         type: [integer, "null"]
 *                         example: 230
 *                       marketGroupId:
 *                         type: [integer, "null"]
 *                         example: 516
 *                       mass:
 *                         type: number
 *                         example: 1E+35
 *                       metaGroupId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       portionSize:
 *                         type: integer
 *                         example: 100
 *                       published:
 *                         type: boolean
 *                         example: true
 *                       raceId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       radius:
 *                         type: [number, "null"]
 *                         example: null
 *                       soundId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       volume:
 *                         type: number
 *                         example: 0.35
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
