import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/characters/{id}:
 *   get:
 *     summary: Get character details by ID
 *     description: Returns comprehensive information for a specific character including corporation, alliance, and security status.
 *     tags:
 *       - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The character ID
 *         schema:
 *           type: integer
 *           example: 2116199184
 *     responses:
 *       '200':
 *         description: Character details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - characterId
 *                 - name
 *                 - corporationId
 *                 - updatedAt
 *               properties:
 *                 characterId:
 *                   type: integer
 *                   example: 2116199184
 *                 name:
 *                   type: string
 *                   example: "Ruslan Taron"
 *                 corporationId:
 *                   type: integer
 *                   example: 1000172
 *                 allianceId:
 *                   type: [integer, "null"]
 *                   example: 0
 *                 factionId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 securityStatus:
 *                   type: [number, "null"]
 *                   example: 0.022480793
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-28T09:54:52.746Z"
 *       '404':
 *         description: Character not found
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
 *                   example: "Character not found"
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
