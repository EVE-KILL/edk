import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/alliances:
 *   get:
 *     summary: Get alliance list
 *     description: Returns a paginated list of alliances, optionally filtered by search term.
 *     tags:
 *       - Alliances
 *     parameters:
 *       - name: search
 *         in: query
 *         description: Search term to filter alliances
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
 *         description: List of alliances
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alliances:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       allianceId:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       ticker:
 *                         type: string
 *                       dateFounded:
 *                         type: string
 *                         format: date-time
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *             example:
 *               alliances:
 *                 - allianceId: 2085230220
 *                   name: "First Church Of The Goo"
 *                   ticker: "F-GOO"
 *                   dateFounded: "2009-12-28T00:00:00.000Z"
 *               page: 1
 *               perPage: 50
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

  let alliances;
  if (search) {
    alliances = await sql`
      SELECT * FROM alliances
      WHERE LOWER(name) LIKE ${`%${search.toLowerCase()}%`}
      ORDER BY name
      LIMIT ${perPage} OFFSET ${offset}
    `;
  } else {
    alliances = await sql`
      SELECT * FROM alliances
      ORDER BY "allianceId" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;
  }

  return {
    alliances,
    page,
    perPage,
  };
});
