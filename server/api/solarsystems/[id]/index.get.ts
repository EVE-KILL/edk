import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/solarsystems/{id}:
 *   get:
 *     summary: Get solar system details by ID
 *     description: Returns comprehensive information for a specific solar system including security status, stargates, planets, and spatial coordinates.
 *     tags:
 *       - Solar Systems
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The solar system ID
 *         schema:
 *           type: integer
 *           example: 30000142
 *     responses:
 *       '200':
 *         description: Solar system details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - solarSystemId
 *                 - name
 *                 - constellationId
 *                 - regionId
 *                 - updatedAt
 *               properties:
 *                 solarSystemId:
 *                   type: integer
 *                   example: 30000142
 *                 name:
 *                   type: string
 *                   example: "Jita"
 *                 constellationId:
 *                   type: integer
 *                   example: 20000020
 *                 regionId:
 *                   type: integer
 *                   example: 10000002
 *                 securityStatus:
 *                   type: number
 *                   example: 0.945913
 *                 securityClass:
 *                   type: [string, "null"]
 *                   example: "B"
 *                 factionId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 starId:
 *                   type: [integer, "null"]
 *                   example: 40009076
 *                 hub:
 *                   type: boolean
 *                   example: true
 *                 border:
 *                   type: boolean
 *                   example: true
 *                 regional:
 *                   type: boolean
 *                   example: true
 *                 positionX:
 *                   type: number
 *                   example: -129064861735000000
 *                 positionY:
 *                   type: number
 *                   example: 60755306910000000
 *                 positionZ:
 *                   type: number
 *                   example: 117469227060000000
 *                 radius:
 *                   type: number
 *                   example: 3591948992512
 *                 luminosity:
 *                   type: [number, "null"]
 *                   example: 1.692
 *                 wormholeClassId:
 *                   type: [integer, "null"]
 *                   example: null
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-28T09:28:54.227Z"
 *       '404':
 *         description: Solar system not found
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
 *                   example: "Solar system not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const solarSystem = await database.findOne(
    'SELECT * FROM solarsystems WHERE "solarSystemId" = :id',
    { id }
  );

  if (!solarSystem) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Solar system not found',
    });
  }

  return solarSystem;
});
