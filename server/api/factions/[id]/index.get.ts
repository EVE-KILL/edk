import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/factions/{id}:
 *   get:
 *     summary: Get faction details by ID
 *     description: Returns comprehensive information for a specific faction including militia corporation and home solar system.
 *     tags:
 *       - Factions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The faction ID
 *         schema:
 *           type: integer
 *           example: 500001
 *     responses:
 *       '200':
 *         description: Faction details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - factionId
 *                 - name
 *                 - corporationId
 *               properties:
 *                 factionId:
 *                   type: integer
 *                   example: 500001
 *                 name:
 *                   type: string
 *                   example: "Caldari State"
 *                 description:
 *                   type: string
 *                   example: "The Caldari State is ruled by several mega-corporations..."
 *                 shortDescription:
 *                   type: [string, "null"]
 *                   example: "In the Caldari State, there is no higher honor than bringing glory to one's corporation."
 *                 corporationId:
 *                   type: integer
 *                   example: 1000035
 *                 militiaCorporationId:
 *                   type: [integer, "null"]
 *                   example: 1000180
 *                 solarSystemId:
 *                   type: integer
 *                   example: 30000145
 *       '404':
 *         description: Faction not found
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
 *                   example: "Faction not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const faction = await database.findOne(
    'SELECT * FROM factions WHERE "factionId" = :id',
    { id }
  );

  if (!faction) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Faction not found',
    });
  }

  return faction;
});
