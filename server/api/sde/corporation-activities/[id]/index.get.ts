import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { CorporationActivity } from '~/models/corporationActivities';

/**
 * @openapi
 * /api/sde/corporation-activities/{id}:
 *   get:
 *     summary: Get corporation activity by ID
 *     description: Returns a single corporation activity from the Static Data Export.
 *     tags:
 *       - SDE - Miscellaneous
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The corporation activity ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: CorporationActivity details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: CorporationActivity not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The corporation activity ID'),
    }),
  });

  const item = await database.findOne<CorporationActivity>(
    `SELECT * FROM corporationactivities WHERE "activityId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'CorporationActivity not found',
    });
  }

  return item;
});
