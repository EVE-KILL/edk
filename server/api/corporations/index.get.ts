import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/corporations:
 *   get:
 *     summary: Get paginated corporation list
 *     description: Returns a paginated list of corporations with optional search filtering. Sorted by most recent corporation ID when no search term is provided.
 *     tags:
 *       - Corporations
 *     parameters:
 *       - name: search
 *         in: query
 *         required: false
 *         description: Search term to filter corporations by name (case-insensitive)
 *         schema:
 *           type: string
 *           example: "Goonswarm"
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
 *         description: Paginated list of corporations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - corporations
 *                 - page
 *                 - perPage
 *               properties:
 *                 corporations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       corporationId:
 *                         type: integer
 *                         example: 98356193
 *                       name:
 *                         type: string
 *                         example: "C C P Alliance Holding"
 *                       ticker:
 *                         type: string
 *                         example: "BSRB"
 *                       ceoId:
 *                         type: integer
 *                         example: 1867734225
 *                       creatorId:
 *                         type: integer
 *                         example: 2089166326
 *                       dateFounded:
 *                         type: string
 *                         format: date-time
 *                         example: "2010-06-29T00:00:00.000Z"
 *                       allianceId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       factionId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       memberCount:
 *                         type: integer
 *                         example: 0
 *                       shares:
 *                         type: string
 *                         example: "0"
 *                       taxRate:
 *                         type: number
 *                         example: 0
 *                       url:
 *                         type: string
 *                         example: ""
 *                       description:
 *                         type: string
 *                         example: ""
 *                       homeStationId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       warEligible:
 *                         type: [boolean, "null"]
 *                         example: null
 *                       lastActive:
 *                         type: [string, "null"]
 *                         format: date-time
 *                         example: null
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-28T10:12:43.410Z"
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
