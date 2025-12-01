import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/wars:
 *   get:
 *     summary: Get paginated war list
 *     description: Returns a paginated list of wars from the database, sorted by war ID in descending order.
 *     tags:
 *       - Wars
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
 *         description: Paginated list of wars
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - wars
 *                 - page
 *                 - perPage
 *               properties:
 *                 wars:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       warId:
 *                         type: string
 *                         example: "999999999999999"
 *                       aggressorAllianceId:
 *                         type: [string, "null"]
 *                         example: "500001"
 *                       aggressorCorporationId:
 *                         type: [string, "null"]
 *                         example: null
 *                       aggressorIskDestroyed:
 *                         type: integer
 *                         example: 0
 *                       aggressorShipsKilled:
 *                         type: integer
 *                         example: 0
 *                       defenderAllianceId:
 *                         type: [string, "null"]
 *                         example: "500004"
 *                       defenderCorporationId:
 *                         type: [string, "null"]
 *                         example: null
 *                       defenderIskDestroyed:
 *                         type: integer
 *                         example: 0
 *                       defenderShipsKilled:
 *                         type: integer
 *                         example: 0
 *                       declared:
 *                         type: string
 *                         format: date-time
 *                         example: "2003-05-06T00:00:00.000Z"
 *                       started:
 *                         type: [string, "null"]
 *                         format: date-time
 *                         example: "2003-05-06T00:00:00.000Z"
 *                       retracted:
 *                         type: [string, "null"]
 *                         format: date-time
 *                         example: null
 *                       finished:
 *                         type: [string, "null"]
 *                         format: date-time
 *                         example: null
 *                       mutual:
 *                         type: boolean
 *                         example: true
 *                       openForAllies:
 *                         type: boolean
 *                         example: false
 *                       lastUpdated:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-28T10:28:45.458Z"
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

  const wars = await sql`
    SELECT * FROM wars
    ORDER BY "warId" DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;

  return {
    wars,
    page,
    perPage,
  };
});
