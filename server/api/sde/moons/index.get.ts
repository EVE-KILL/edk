import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Moon } from '~/models/moons';

/**
 * @openapi
 * /api/sde/moons:
 *   get:
 *     summary: Get moons
 *     description: Returns a paginated list of moons from the Static Data Export.
 *     tags:
 *       - SDE - Map
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
 *         description: List of moons
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       moonId:
 *                         type: integer
 *                       name:
 *                         type: string
 *                         nullable: true
 *                       solarSystemId:
 *                         type: integer
 *                       typeId:
 *                         type: integer
 *                       celestialIndex:
 *                         type: integer
 *                       positionX:
 *                         type: number
 *                       positionY:
 *                         type: number
 *                       positionZ:
 *                         type: number
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *                 total:
 *                   type: integer
 *             example:
 *               items:
 *                 - moonId: 40000025
 *                   name: null
 *                   solarSystemId: 30000002
 *                   typeId: 14
 *                   celestialIndex: 1
 *                   positionX: -71539852816
 *                   positionY: -4314537310
 *                   positionZ: 13504425940
 *               page: 1
 *               perPage: 100
 *               total: 342170
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
    database.query<Moon>(
      `SELECT * FROM moons ORDER BY "moonId" LIMIT :limit OFFSET :offset`,
      { limit: perPage, offset }
    ),
    database.findOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM moons`
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
