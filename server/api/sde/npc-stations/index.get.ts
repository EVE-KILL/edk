import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { NpcStation } from '~/models/npcStations';

/**
 * @openapi
 * /api/sde/npc-stations:
 *   get:
 *     summary: Get NPC stations
 *     description: Returns a paginated list of NPC stations from the Static Data Export. Includes space stations, starbases, and station facilities.
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
 *         description: List of NPC stations
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
 *                       stationId:
 *                         type: integer
 *                         description: Unique station ID
 *                         example: 60000001
 *                       name:
 *                         type: [string, "null"]
 *                         description: Station name
 *                         example: null
 *                       solarSystemId:
 *                         type: integer
 *                         description: Solar system containing station
 *                         example: 30002780
 *                       typeId:
 *                         type: integer
 *                         description: Station type ID
 *                         example: 1531
 *                       celestialIndex:
 *                         type: integer
 *                         description: Celestial index in system
 *                         example: 10
 *                       operationId:
 *                         type: integer
 *                         description: Station operation type
 *                         example: 26
 *                       orbitId:
 *                         type: integer
 *                         description: Orbit ID
 *                         example: 40176406
 *                       orbitIndex:
 *                         type: integer
 *                         description: Orbit index
 *                         example: 3
 *                       positionX:
 *                         type: number
 *                         description: X coordinate
 *                         example: 1723680890880
 *                       positionY:
 *                         type: number
 *                         description: Y coordinate
 *                         example: 256414064640
 *                       positionZ:
 *                         type: number
 *                         description: Z coordinate
 *                         example: -60755435520
 *                       reprocessingEfficiency:
 *                         type: number
 *                         description: Reprocessing efficiency (0-1)
 *                         example: 0.5
 *                       reprocessingStationsTake:
 *                         type: number
 *                         description: Station tax on reprocessing
 *                         example: 0.05
 *                       useOperationName:
 *                         type: boolean
 *                         description: Whether to use operation name
 *                         example: true
 *                       ownerIds:
 *                         type: [array, "null"]
 *                         description: Owner corporation IDs
 *                         example: null
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 100
 *                 total:
 *                   type: integer
 *                   example: 2650
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
    database.query<NpcStation>(
      `SELECT * FROM npcstations ORDER BY "stationId" LIMIT :limit OFFSET :offset`,
      { limit: perPage, offset }
    ),
    database.findOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM npcstations`
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
