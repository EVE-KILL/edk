import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { DynamicItemAttribute } from '~/models/dynamicItemAttributes';

/**
 * @openapi
 * /api/sde/dynamic-item-attributes:
 *   get:
 *     summary: Get dynamic item attributes
 *     description: Returns a paginated list of dynamic item attributes from the Static Data Export. Includes attribute variation ranges and input/output mappings for item mutations.
 *     tags:
 *       - SDE - Miscellaneous
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
 *         description: List of dynamic item attributes
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
 *                       typeId:
 *                         type: integer
 *                         description: Item type ID
 *                         example: 47297
 *                       attributeIds:
 *                         type: array
 *                         description: List of dynamic attributes with variation ranges
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 6
 *                             min:
 *                               type: number
 *                               example: 0.6
 *                             max:
 *                               type: number
 *                               example: 1.4
 *                       inputOutputMapping:
 *                         type: array
 *                         description: Mutation mappings for item transformation
 *                         items:
 *                           type: object
 *                           properties:
 *                             resultingType:
 *                               type: integer
 *                               description: Type ID produced by mutation
 *                               example: 47408
 *                             applicableTypes:
 *                               type: array
 *                               description: Source type IDs that can produce this result
 *                               items:
 *                                 type: integer
 *                               example: [5975, 12052, 12076]
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 100
 *                 total:
 *                   type: integer
 *                   example: 413
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
    database.query<DynamicItemAttribute>(
      `SELECT * FROM dynamicitemattributes ORDER BY "typeId" LIMIT :limit OFFSET :offset`,
      { limit: perPage, offset }
    ),
    database.findOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM dynamicitemattributes`
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
