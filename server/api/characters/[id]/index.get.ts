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
 *           example: 95465499
 *     responses:
 *       '200':
 *         description: Character details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 characterId:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 corporationId:
 *                   type: integer
 *                   nullable: true
 *                 allianceId:
 *                   type: integer
 *                   nullable: true
 *                 factionId:
 *                   type: integer
 *                   nullable: true
 *                 securityStatus:
 *                   type: number
 *                   nullable: true
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *             example:
 *               characterId: 95465499
 *               name: "Karbowiak"
 *               corporationId: 98356193
 *               allianceId: 933731581
 *               factionId: null
 *               securityStatus: -2.345
 *               updatedAt: "2025-12-01T10:30:45.000Z"
 *       '404':
 *         description: Character not found
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 404
 *               statusMessage: "Character not found"
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
