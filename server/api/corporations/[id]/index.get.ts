import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/corporations/{id}:
 *   get:
 *     summary: Get corporation details by ID
 *     description: Returns comprehensive information for a specific corporation including CEO, alliance, and founding date.
 *     tags:
 *       - Corporations
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The corporation ID
 *         schema:
 *           type: integer
 *           example: 98356193
 *     responses:
 *       '200':
 *         description: Corporation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - corporationId
 *                 - name
 *                 - updatedAt
 *               properties:
 *                 corporationId:
 *                   type: integer
 *                   example: 98356193
 *                 name:
 *                   type: string
 *                   example: "C C P Alliance Holding"
 *                 ticker:
 *                   type: [string, "null"]
 *                   example: "BSRB"
 *                 ceoId:
 *                   type: [integer, "null"]
 *                   example: 92025524
 *                 memberCount:
 *                   type: [integer, "null"]
 *                   example: 0
 *                 allianceId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 factionId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 dateFounded:
 *                   type: [string, "null"]
 *                   format: date-time
 *                   example: "2014-11-12T00:00:00.000Z"
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-28T10:12:25.387Z"
 *       '404':
 *         description: Corporation not found
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
 *                   example: "Corporation not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const corporation = await database.findOne<{
    corporationId: number;
    name: string;
    ticker: string | null;
    memberCount: number | null;
    allianceId: number | null;
    ceoId: number | null;
    dateFounded: Date | null;
    factionId: number | null;
    updatedAt: Date;
  }>(
    `SELECT "corporationId", "name", "ticker", "memberCount", "allianceId", "ceoId", "dateFounded", "factionId", "updatedAt"
     FROM corporations
     WHERE "corporationId" = :id`,
    { id }
  );

  if (!corporation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Corporation not found',
    });
  }

  return corporation;
});
