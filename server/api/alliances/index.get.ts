import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/alliances:
 *   get:
 *     summary: Get paginated alliance list
 *     description: Returns a paginated list of alliances with optional search filtering. Sorted by most recent alliance ID when no search term is provided.
 *     tags:
 *       - Alliances
 *     parameters:
 *       - name: search
 *         in: query
 *         required: false
 *         description: Search term to filter alliances by name (case-insensitive)
 *         schema:
 *           type: string
 *           example: "Imperium"
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
 *         description: Paginated list of alliances
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - alliances
 *                 - page
 *                 - perPage
 *               properties:
 *                 alliances:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       allianceId:
 *                         type: integer
 *                         example: 2085230220
 *                       name:
 *                         type: string
 *                         example: "First Church Of The Goo"
 *                       ticker:
 *                         type: string
 *                         example: "F-GOO"
 *                       creatorId:
 *                         type: integer
 *                         example: 1055395479
 *                       creatorCorporationId:
 *                         type: integer
 *                         example: 0
 *                       executorCorporationId:
 *                         type: integer
 *                         example: 0
 *                       dateFounded:
 *                         type: string
 *                         format: date-time
 *                         example: "2009-12-28T00:00:00.000Z"
 *                       factionId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       lastActive:
 *                         type: [string, "null"]
 *                         format: date-time
 *                         example: null
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-28T10:12:54.506Z"
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
