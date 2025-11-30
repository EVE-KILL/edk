import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/alliances/{id}:
 *   get:
 *     summary: Get alliance details
 *     description: Returns alliance information from the database.
 *     tags:
 *       - Alliances
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The alliance ID
 *         schema:
 *           type: integer
 *           example: 933731581
 *     responses:
 *       '200':
 *         description: Alliance details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 allianceId:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 ticker:
 *                   type: string
 *                   nullable: true
 *                 executorCorporationId:
 *                   type: integer
 *                   nullable: true
 *                 dateFounded:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *                 factionId:
 *                   type: integer
 *                   nullable: true
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *             example:
 *               allianceId: 933731581
 *               name: "Northern Coalition."
 *               ticker: "NC."
 *               executorCorporationId: 98356193
 *               dateFounded: "2008-05-15T00:00:00.000Z"
 *               factionId: null
 *               updatedAt: "2025-12-01T10:30:45.000Z"
 *       '404':
 *         description: Alliance not found
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 404
 *               statusMessage: "Alliance not found"
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
