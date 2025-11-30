import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/characters:
 *   get:
 *     summary: Get character list
 *     description: Returns a paginated list of characters, optionally filtered by search term.
 *     tags:
 *       - Characters
 *     parameters:
 *       - name: search
 *         in: query
 *         description: Search term to filter characters
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
 *         description: List of characters
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
 *                 - characterId: 2116199184
 *                   characterName: "Example Character"
 *                   corporationId: 98356193
 *                   corporationName: "Example Corp"
 *                   allianceId: 99000001
 *                   allianceName: "Example Alliance"
 *                   factionId: null
 *                   securityStatus: -5.2
 *                   updatedAt: "2025-12-01T10:30:45.000Z"
 *               page: 1
 *               perPage: 50
 *               total: 850234
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
