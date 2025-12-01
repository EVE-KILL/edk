import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { SolarSystem } from '~/models/solarSystems';

/**
 * @openapi
 * /api/sde/solar-systems/{id}:
 *   get:
 *     summary: Get solar system by ID
 *     description: Returns a single solar system from the Static Data Export.
 *     tags:
 *       - SDE - Regions
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
 *                 - regionId
 *                 - constellationId
 *                 - securityStatus
 *               properties:
 *                 solarSystemId:
 *                   type: integer
 *                   description: Unique solar system identifier
 *                 name:
 *                   type: string
 *                   description: Solar system name
 *                 regionId:
 *                   type: integer
 *                   description: Parent region ID
 *                 constellationId:
 *                   type: integer
 *                   description: Parent constellation ID
 *                 starId:
 *                   type: integer
 *                   description: Primary star ID
 *                 securityStatus:
 *                   type: number
 *                   description: Security status (-10.0 to 5.0)
 *                 securityClass:
 *                   type: string
 *                   description: Security class (A-H)
 *                 luminosity:
 *                   type: number
 *                   description: Star luminosity
 *                 border:
 *                   type: boolean
 *                   description: Whether system is on border
 *                 hub:
 *                   type: boolean
 *                   description: Whether system is a hub
 *                 international:
 *                   type: boolean
 *                   description: Whether system is international
 *                 regional:
 *                   type: boolean
 *                   description: Whether system is regional
 *                 positionX:
 *                   type: number
 *                   description: X coordinate
 *                 positionY:
 *                   type: number
 *                   description: Y coordinate
 *                 positionZ:
 *                   type: number
 *                   description: Z coordinate
 *                 radius:
 *                   type: number
 *                   description: System radius
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   description: Last update timestamp
 *       '404':
 *         description: Solar system not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The solar system ID'),
    }),
  });

  const item = await database.findOne<SolarSystem>(
    `SELECT * FROM solarsystems WHERE "solarSystemId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'SolarSystem not found',
    });
  }

  return item;
});
