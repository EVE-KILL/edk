import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { StationOperation } from '~/models/stationOperations';

/**
 * @openapi
 * /api/sde/station-operations/{id}:
 *   get:
 *     summary: Get station operation by ID
 *     description: Returns a single station operation from the Static Data Export.
 *     tags:
 *       - SDE - NPCs
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The station operation ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: StationOperation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: StationOperation not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The station operation ID'),
    }),
  });

  const item = await database.findOne<StationOperation>(
    `SELECT * FROM stationoperations WHERE "operationId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'StationOperation not found',
    });
  }

  return item;
});
