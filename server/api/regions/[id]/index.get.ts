import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/regions/{id}:
 *   get:
 *     summary: Get region details by ID
 *     description: Returns comprehensive information for a specific region including constellations, faction, and spatial coordinates.
 *     tags:
 *       - Regions
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
 *                 - updatedAt
 *               properties:
 *                 regionId:
 *                   type: integer
 *                   example: 10000001
 *                 name:
 *                   type: string
 *                   example: "Derelik"
 *                 description:
 *                   type: [string, "null"]
 *                   example: "The Derelik region, sovereign seat of the Ammatar Mandate..."
 *                 factionId:
 *                   type: [integer, "null"]
 *                   example: 500007
 *                 constellationIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *                   example: [20000001, 20000002, 20000003]
 *                 nebulaId:
 *                   type: [integer, "null"]
 *                   example: 11799
 *                 positionX:
 *                   type: number
 *                   example: -77361951922776930
 *                 positionY:
 *                   type: number
 *                   example: 50878032664301930
 *                 positionZ:
 *                   type: number
 *                   example: -64433101266115400
 *                 wormholeClassId:
 *                   type: [integer, "null"]
 *                   example: 7
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-11-28T09:28:54.156Z"
 *       '404':
 *         description: Region not found
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
 *                   example: "Region not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const region = await database.findOne(
    'SELECT * FROM regions WHERE "regionId" = :id',
    { id }
  );

  if (!region) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Region not found',
    });
  }

  return region;
});
