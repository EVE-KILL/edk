import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/constellations/{id}:
 *   get:
 *     summary: Get constellation details by ID
 *     description: Returns comprehensive information for a specific constellation including solar systems, faction, and spatial coordinates.
 *     tags:
 *       - Constellations
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The constellation ID
 *         schema:
 *           type: integer
 *           example: 20000001
 *     responses:
 *       '200':
 *         description: Constellation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - constellationId
 *                 - name
 *                 - regionId
 *                 - updatedAt
 *               properties:
 *                 constellationId:
 *                   type: integer
 *                   example: 20000001
 *                 name:
 *                   type: string
 *                   example: "San Matar"
 *                 regionId:
 *                   type: integer
 *                   example: 10000001
 *                 factionId:
 *                   type: [integer, "null"]
 *                   example: 500007
 *                 solarSystemIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   example: [30000001, 30000002, 30000003]
 *                 positionX:
 *                   type: number
 *                   example: -94046559700991340
 *                 positionY:
 *                   type: number
 *                   example: 49520153153798850
 *                 positionZ:
 *                   type: number
 *                   example: -42738731818401970
 *                 wormholeClassId:
 *                   type: [integer, "null"]
 *                   example: 7
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-28T09:28:54.179Z"
 *       '404':
 *         description: Constellation not found
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
 *                   example: "Constellation not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const constellation = await database.findOne(
    'SELECT * FROM constellations WHERE "constellationId" = :id',
    { id }
  );

  if (!constellation) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Constellation not found',
    });
  }

  return constellation;
});
