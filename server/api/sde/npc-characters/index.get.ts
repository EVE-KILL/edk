import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { NpcCharacter } from '~/models/npcCharacters';

/**
 * @openapi
 * /api/sde/npc-characters:
 *   get:
 *     summary: Get NPC characters
 *     description: Returns a paginated list of NPC characters from the Static Data Export. Includes mission agents, faction representatives, and NPCs.
 *     tags:
 *       - SDE - Characters
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: perPage
 *         in: query
 *         description: Items per page (max 500)
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 500
 *     responses:
 *       '200':
 *         description: List of NPC characters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - items
 *                 - page
 *                 - perPage
 *                 - total
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       characterId:
 *                         type: integer
 *                         description: Unique character ID
 *                         example: 3000001
 *                       name:
 *                         type: string
 *                         description: Character name
 *                         example: "Dame Hel"
 *                       corporationId:
 *                         type: integer
 *                         description: Corporation ID
 *                         example: 1000001
 *                       allianceId:
 *                         type: [integer, "null"]
 *                         description: Alliance ID if applicable
 *                         example: null
 *                       bloodlineId:
 *                         type: integer
 *                         description: Bloodline ID
 *                         example: 1
 *                       ancestryId:
 *                         type: [integer, "null"]
 *                         description: Ancestry ID if applicable
 *                         example: null
 *                       raceId:
 *                         type: integer
 *                         description: Race ID
 *                         example: 1
 *                       gender:
 *                         type: integer
 *                         description: Gender (0 = male, 1 = female)
 *                         example: 0
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 100
 *                 total:
 *                   type: integer
 *                   example: 11303
 */
export default defineEventHandler(async (event) => {
  const { query } = await validate(event, {
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(500).default(100),
    }),
  });

  const { page, perPage } = query;
  const offset = (page - 1) * perPage;

  const [items, totalResult] = await Promise.all([
    database.query<NpcCharacter>(
      `SELECT * FROM npccharacters ORDER BY "characterId" LIMIT :limit OFFSET :offset`,
      { limit: perPage, offset }
    ),
    database.findOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM npccharacters`
    ),
  ]);

  const total = totalResult?.count ?? 0;

  return {
    items,
    page,
    perPage,
    total,
  };
});
