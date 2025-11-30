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
 *           example: 123456
 *     responses:
 *       '200':
 *         description: Alliance details
 *       '404':
 *         description: Alliance not found
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
