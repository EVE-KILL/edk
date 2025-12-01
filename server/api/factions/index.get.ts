import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/factions:
 *   get:
 *     summary: Get paginated faction list
 *     description: Returns a paginated list of all factions in EVE Online. Sorted by faction ID.
 *     tags:
 *       - Factions
 *     parameters:
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
 *         description: Paginated list of factions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - factions
 *                 - page
 *                 - perPage
 *               properties:
 *                 factions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       factionId:
 *                         type: integer
 *                         example: 500001
 *                       name:
 *                         type: string
 *                         example: "Caldari State"
 *                       description:
 *                         type: string
 *                         example: "The Caldari State is ruled by several mega-corporations..."
 *                       shortDescription:
 *                         type: [string, "null"]
 *                         example: "The Caldari State"
 *                       corporationId:
 *                         type: integer
 *                         example: 1000125
 *                       militiaCorporationId:
 *                         type: [integer, "null"]
 *                         example: null
 *                       solarSystemId:
 *                         type: integer
 *                         example: 30000379
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
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(200).default(50),
    }),
  });

  const { page, perPage } = query;
  const offset = (page - 1) * perPage;
  const sql = database.sql;

  const factions = await sql`
    SELECT * FROM factions
    ORDER BY "factionId"
    LIMIT ${perPage} OFFSET ${offset}
  `;

  return {
    factions,
    page,
    perPage,
  };
});
