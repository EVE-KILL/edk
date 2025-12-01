import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/characters:
 *   get:
 *     summary: Get paginated character list
 *     description: Returns a paginated list of characters with optional search filtering. Sorted by most recent character ID when no search term is provided.
 *     tags:
 *       - Characters
 *     parameters:
 *       - name: search
 *         in: query
 *         required: false
 *         description: Search term to filter characters by name (case-insensitive)
 *         schema:
 *           type: string
 *           example: "Ruslan"
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
 *         description: Paginated list of characters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - characters
 *                 - page
 *                 - perPage
 *               properties:
 *                 characters:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       characterId:
 *                         type: integer
 *                         example: 2123951681
 *                       name:
 *                         type: string
 *                         example: "Kgc Twelve"
 *                       corporationId:
 *                         type: integer
 *                         example: 1000166
 *                       allianceId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       factionId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       raceId:
 *                         type: integer
 *                         example: 4
 *                       bloodlineId:
 *                         type: integer
 *                         example: 13
 *                       gender:
 *                         type: string
 *                         enum: ["male", "female"]
 *                         example: "male"
 *                       birthday:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-30T00:00:00.000Z"
 *                       description:
 *                         type: string
 *                         example: ""
 *                       title:
 *                         type: [string, "null"]
 *                         example: null
 *                       securityStatus:
 *                         type: number
 *                         example: 0
 *                       lastActive:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-30T22:30:48.000Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-30T22:32:26.262Z"
 *                       deleted:
 *                         type: boolean
 *                         example: false
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

  let characters;
  if (search) {
    // Use search index
    characters = await sql`
      SELECT * FROM characters
      WHERE LOWER(name) LIKE ${`%${search.toLowerCase()}%`}
      ORDER BY name
      LIMIT ${perPage} OFFSET ${offset}
    `;
  } else {
    // Get all characters (sorted by most recent activity)
    characters = await sql`
      SELECT * FROM characters
      ORDER BY "characterId" DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;
  }

  return {
    characters,
    page,
    perPage,
  };
});
