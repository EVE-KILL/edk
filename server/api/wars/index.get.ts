import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/wars:
 *   get:
 *     summary: Get war list
 *     description: Returns a paginated list of wars.
 *     tags:
 *       - Wars
 *     parameters:
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
 *         description: List of wars
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 wars:
 *                   type: array
 *                   items:
 *                     type: object
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 *             example:
 *               wars:
 *               wars:
 *                 - warId: "999999999999999"
 *                   aggressorAllianceId: "500001"
 *                   aggressorCorporationId: null
 *                   aggressorIskDestroyed: 0
 *                   aggressorShipsKilled: 0
 *                   defenderAllianceId: "500004"
 *                   defenderCorporationId: null
 *                   defenderIskDestroyed: 0
 *                   defenderShipsKilled: 0
 *                   declared: "2003-05-06T00:00:00.000Z"
 *                   started: "2003-05-06T00:00:00.000Z"
 *                   retracted: null
 *                   finished: null
 *                   mutual: true
 *                   openForAllies: false
 *                   lastUpdated: "2025-11-28T10:28:45.458Z"
 *               page: 1
 *               perPage: 50
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
