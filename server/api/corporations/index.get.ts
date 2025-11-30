import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/corporations:
 *   get:
 *     summary: Get corporation list
 *     description: Returns a paginated list of corporations, optionally filtered by search term.
 *     tags:
 *       - Corporations
 *     parameters:
 *       - name: search
 *         in: query
 *         description: Search term to filter corporations
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
 *         description: List of corporations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *                 total:
 *                   type: integer
 *             example:
 *               items:
 *                 - corporationId: 98356193
 *                   corporationName: "Example Corporation"
 *                   ticker: "EXMPL"
 *                   allianceId: 99000001
 *                   allianceName: "Example Alliance"
 *                   factionId: null
 *                   dateFounded: "2010-05-15T12:00:00.000Z"
 *                   ceoId: 2116199184
 *                   updatedAt: "2025-12-01T10:30:45.000Z"
 *               page: 1
 *               perPage: 50
 *               total: 234567
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

  let corporations;
  if (search) {
    corporations = await sql`
      SELECT * FROM corporations
      WHERE LOWER(name) LIKE ${`%${search.toLowerCase()}%`}
      ORDER BY name
      LIMIT ${perPage} OFFSET ${offset}
    `;
  } else {
    corporations = await sql`
      SELECT * FROM corporations
      ORDER BY "corporationId" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;
  }

  return {
    corporations,
    page,
    perPage,
  };
});
