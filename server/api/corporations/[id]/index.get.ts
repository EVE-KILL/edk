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
 *           example: 123456
 *     responses:
 *       '200':
 *         description: Corporation details
 *       '404':
 *         description: Corporation not found
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
