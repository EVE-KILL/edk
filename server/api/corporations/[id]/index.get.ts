import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/corporations/{id}:
 *   get:
 *     summary: Get corporation details
 *     description: Returns corporation information from the database.
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
 *               properties:
 *                 corporationId:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 ticker:
 *                   type: string
 *                   nullable: true
 *                 memberCount:
 *                   type: integer
 *                   nullable: true
 *                 allianceId:
 *                   type: integer
 *                   nullable: true
 *                 ceoId:
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
 *               corporationId: 98356193
 *               name: "Synthetic Systems"
 *               ticker: "SYNTH"
 *               memberCount: 42
 *               allianceId: 933731581
 *               ceoId: 95465499
 *               dateFounded: "2015-03-15T00:00:00.000Z"
 *               factionId: null
 *               updatedAt: "2025-12-01T10:30:45.000Z"
 *       '404':
 *         description: Corporation not found
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 404
 *               statusMessage: "Corporation not found"
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
