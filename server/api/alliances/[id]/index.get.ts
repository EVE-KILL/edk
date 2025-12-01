import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/alliances/{id}:
 *   get:
 *     summary: Get alliance details by ID
 *     description: Returns comprehensive information for a specific alliance including executor corporation and founding date.
 *     tags:
 *       - Alliances
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The alliance ID
 *         schema:
 *           type: integer
 *           example: 99000001
 *     responses:
 *       '200':
 *         description: Alliance details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - allianceId
 *                 - name
 *                 - updatedAt
 *               properties:
 *                 allianceId:
 *                   type: integer
 *                   example: 99000001
 *                 name:
 *                   type: string
 *                   example: "Vertex Dryrun Test Corp Alliance"
 *                 ticker:
 *                   type: [string, "null"]
 *                   example: "VDTCA"
 *                 executorCorporationId:
 *                   type: [integer, "null"]
 *                   example: 0
 *                 factionId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 dateFounded:
 *                   type: [string, "null"]
 *                   format: date-time
 *                   example: "2010-11-02T00:00:00.000Z"
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-28T10:12:54.085Z"
 *       '404':
 *         description: Alliance not found
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
 *                   example: "Alliance not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const alliance = await database.findOne<{
    allianceId: number;
    name: string;
    ticker: string | null;
    executorCorporationId: number | null;
    dateFounded: Date | null;
    factionId: number | null;
    updatedAt: Date;
  }>(
    `SELECT "allianceId", "name", "ticker", "executorCorporationId", "dateFounded", "factionId", "updatedAt"
     FROM alliances
     WHERE "allianceId" = :id`,
    { id }
  );

  if (!alliance) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Alliance not found',
    });
  }

  return alliance;
});
