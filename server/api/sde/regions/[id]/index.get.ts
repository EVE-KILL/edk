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
 *       - SDE - Map
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The region ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Region details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
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
