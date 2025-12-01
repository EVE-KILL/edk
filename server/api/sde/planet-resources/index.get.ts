import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { PlanetResource } from '~/models/planetResources';

/**
 * @openapi
 * /api/sde/planet-resources:
 *   get:
 *     summary: Get planetary resources
 *     description: Returns a paginated list of planetary resources from the Static Data Export. Includes all resources available on planets for planetary interaction.
 *     tags:
 *       - SDE - Planetary
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
 *         description: List of planetary resources
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
 *                       planetId:
 *                         type: integer
 *                         description: Unique planet ID
 *                         example: 40013180
 *                       power:
 *                         type: number
 *                         description: Power generation on planet
 *                         example: 740
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 100
 *                 total:
 *                   type: integer
 *                   example: 25798
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
    database.query<PlanetResource>(
      `SELECT * FROM planetresources ORDER BY "planetId" LIMIT :limit OFFSET :offset`,
      { limit: perPage, offset }
    ),
    database.findOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM planetresources`
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
