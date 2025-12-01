import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { NpcCorporation } from '~/models/npcCorporations';

/**
 * @openapi
 * /api/sde/npc-corporations:
 *   get:
 *     summary: Get NPC corporations
 *     description: Returns a paginated list of NPC corporations from the Static Data Export. Includes mission-running corporations, incursion entities, and other NPCs.
 *     tags:
 *       - SDE - NPCs
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
 *         description: List of NPC corporations
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
 *                       corporationId:
 *                         type: integer
 *                         description: Unique corporation ID
 *                         example: 1000001
 *                       name:
 *                         type: string
 *                         description: Corporation name
 *                         example: "Guristas"
 *                       tickerName:
 *                         type: string
 *                         description: Corporation ticker
 *                         example: "-GUR-"
 *                       description:
 *                         type: string
 *                         description: Corporation description
 *                         example: "Mission Running Corporation"
 *                       ceoId:
 *                         type: integer
 *                         description: Character ID of CEO
 *                         example: 3001001
 *                       stationId:
 *                         type: integer
 *                         description: Home station ID
 *                         example: 60000001
 *                       taxRate:
 *                         type: number
 *                         description: Tax rate (0-1)
 *                         example: 0.1
 *                       factionId:
 *                         type: [integer, "null"]
 *                         description: Owning faction ID if applicable
 *                         example: null
 *                       solarSystemId:
 *                         type: [integer, "null"]
 *                         description: Home system ID if applicable
 *                         example: null
 *                       deleted:
 *                         type: boolean
 *                         description: Whether corporation is deleted
 *                         example: false
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 100
 *                 total:
 *                   type: integer
 *                   example: 5678
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
    database.query<NpcCorporation>(
      `SELECT * FROM npccorporations ORDER BY "corporationId" LIMIT :limit OFFSET :offset`,
      { limit: perPage, offset }
    ),
    database.findOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM npccorporations`
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
