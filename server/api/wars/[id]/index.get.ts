import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/wars/{id}:
 *   get:
 *     summary: Get war details by ID
 *     description: Returns comprehensive information for a specific war including aggressor and defender details, ISK destroyed, and timeline information.
 *     tags:
 *       - Wars
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The war ID
 *         schema:
 *           type: string
 *           example: "999999999999999"
 *     responses:
 *       '200':
 *         description: War details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - warId
 *                 - declared
 *               properties:
 *                 warId:
 *                   type: string
 *                   example: "999999999999999"
 *                 aggressorAllianceId:
 *                   type: [string, "null"]
 *                   example: "500001"
 *                 aggressorCorporationId:
 *                   type: [string, "null"]
 *                   example: null
 *                 aggressorIskDestroyed:
 *                   type: integer
 *                   example: 0
 *                 aggressorShipsKilled:
 *                   type: integer
 *                   example: 0
 *                 defenderAllianceId:
 *                   type: [string, "null"]
 *                   example: "500004"
 *                 defenderCorporationId:
 *                   type: [string, "null"]
 *                   example: null
 *                 defenderIskDestroyed:
 *                   type: integer
 *                   example: 0
 *                 defenderShipsKilled:
 *                   type: integer
 *                   example: 0
 *                 declared:
 *                   type: string
 *                   format: date-time
 *                   example: "2003-05-06T00:00:00.000Z"
 *                 started:
 *                   type: [string, "null"]
 *                   format: date-time
 *                   example: "2003-05-06T00:00:00.000Z"
 *                 retracted:
 *                   type: [string, "null"]
 *                   format: date-time
 *                   example: null
 *                 finished:
 *                   type: [string, "null"]
 *                   format: date-time
 *                   example: null
 *                 mutual:
 *                   type: boolean
 *                   example: true
 *                 openForAllies:
 *                   type: boolean
 *                   example: false
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-28T10:28:45.458Z"
 *       '404':
 *         description: War not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 404
 *                 statusMessage:
 *                   type: string
 *                   example: "War not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const war = await database.findOne('SELECT * FROM wars WHERE "warId" = :id', {
    id,
  });

  if (!war) {
    throw createError({
      statusCode: 404,
      statusMessage: 'War not found',
    });
  }

  return war;
});
