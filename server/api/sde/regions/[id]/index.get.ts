import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Region } from '~/models/regions';

/**
 * @openapi
 * /api/sde/regions/{id}:
 *   get:
 *     summary: Get region by ID
 *     description: Returns a single region from the Static Data Export.
 *     tags:
 *       - SDE - Regions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The region ID
 *         schema:
 *           type: integer
 *           example: 10000001
 *     responses:
 *       '200':
 *         description: Region details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - regionId
 *                 - name
 *                 - factionId
 *               properties:
 *                 regionId:
 *                   type: integer
 *                   description: Unique region identifier
 *                 name:
 *                   type: string
 *                   description: Region name
 *                 description:
 *                   type: string
 *                   description: Region description
 *                 factionId:
 *                   type: integer
 *                   description: Controlling faction ID
 *                 nebulaId:
 *                   type: integer
 *                   description: Nebula ID
 *                 constellationIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   description: Array of constellation IDs in this region
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
 *                   description: Last update timestamp (ISO 8601)
 *                 wormholeClassId:
 *                   type: integer
 *                   description: Wormhole class ID
 *       '404':
 *         description: Region not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The region ID'),
    }),
  });

  const item = await database.findOne<Region>(
    `SELECT * FROM regions WHERE "regionId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Region not found',
    });
  }

  return item;
});
