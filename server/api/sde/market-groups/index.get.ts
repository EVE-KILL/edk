import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { MarketGroup } from '~/models/marketGroups';

/**
 * @openapi
 * /api/sde/market-groups:
 *   get:
 *     summary: Get market-groups
 *     description: Returns a paginated list of market-groups from the Static Data Export. Market groups organize items in the market UI.
 *     tags:
 *       - SDE - Market
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
 *         description: List of market-groups
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
 *                       marketGroupId:
 *                         type: integer
 *                         description: Unique market group ID
 *                         example: 2
 *                       name:
 *                         type: string
 *                         description: Market group name
 *                         example: "Ship"
 *                       hasTypes:
 *                         type: boolean
 *                         description: Whether group contains item types
 *                         example: false
 *                       description:
 *                         type: string
 *                         description: Market group description
 *                         example: "Everything that flies"
 *                       iconId:
 *                         type: [integer, "null"]
 *                         description: Icon ID for this group
 *                         example: null
 *                       parentGroupId:
 *                         type: [integer, "null"]
 *                         description: Parent group ID if nested
 *                         example: 1
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 100
 *                 total:
 *                   type: integer
 *                   example: 2083
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
    database.query<MarketGroup>(
      `SELECT * FROM marketgroups ORDER BY "marketGroupId" LIMIT :limit OFFSET :offset`,
      { limit: perPage, offset }
    ),
    database.findOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM marketgroups`
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
