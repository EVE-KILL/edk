import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { StationService } from '~/models/stationServices';

/**
 * @openapi
 * /api/sde/station-services/{id}:
 *   get:
 *     summary: Get station service by ID
 *     description: Returns a single station service from the Static Data Export.
 *     tags:
 *       - SDE - NPCs
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The station service ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: StationService details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: StationService not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The station service ID'),
    }),
  });

  const item = await database.findOne<StationService>(
    `SELECT * FROM stationservices WHERE "serviceId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'StationService not found',
    });
  }

  return item;
});
