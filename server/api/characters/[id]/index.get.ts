import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/characters/{id}:
 *   get:
 *     summary: Get character details
 *     description: Returns character information from the database.
 *     tags:
 *       - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The character ID
 *         schema:
 *           type: integer
 *           example: 123456
 *     responses:
 *       '200':
 *         description: Character details
 *       '404':
 *         description: Character not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const character = await database.findOne<{
    characterId: number;
    name: string;
    corporationId: number | null;
    allianceId: number | null;
    factionId: number | null;
    securityStatus: number | null;
    updatedAt: Date;
  }>(
    `SELECT "characterId", "name", "corporationId", "allianceId", "factionId", "securityStatus", "updatedAt"
     FROM characters
     WHERE "characterId" = :id`,
    { id }
  );

  if (!character) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Character not found',
    });
  }

  return character;
});
