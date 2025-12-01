import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Constellation } from '~/models/constellations';

/**
 * @openapi
 * /api/sde/constellations/{id}:
 *   get:
 *     summary: Get constellation by ID
 *     description: Returns a single constellation from the Static Data Export.
 *     tags:
 *       - SDE - Regions
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
 *                 - regionId
 *                 - name
 *                 - factionId
 *               properties:
 *                 constellationId:
 *                   type: integer
 *                   description: Unique constellation identifier
 *                 regionId:
 *                   type: integer
 *                   description: Parent region ID
 *                 name:
 *                   type: string
 *                   description: Constellation name
 *                 factionId:
 *                   type: integer
 *                   description: Faction ID
 *                 solarSystemIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   description: Array of solar system IDs in constellation
 *                 positionX:
 *                   type: number
 *                   description: X coordinate
 *                 positionY:
 *                   type: number
 *                   description: Y coordinate
 *                 positionZ:
 *                   type: number
 *                   description: Z coordinate
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   description: Last update timestamp
 *                 wormholeClassId:
 *                   type: integer
 *                   description: Wormhole class ID
 *       '404':
 *         description: Constellation not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The constellation ID'),
    }),
  });

  const item = await database.findOne<Constellation>(
    `SELECT * FROM constellations WHERE "constellationId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Constellation not found',
    });
  }

  return item;
});
