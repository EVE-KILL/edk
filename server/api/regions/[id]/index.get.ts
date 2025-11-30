import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/regions/{id}:
 *   get:
 *     summary: Get region details
 *     description: Returns region information from the database.
 *     tags:
 *       - Regions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The region ID
 *         schema:
 *           type: integer
 *           example: 10000002
 *     responses:
 *       '200':
 *         description: Region details
 *       '404':
 *         description: Region not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const region = await database.findOne('"mapRegions"', { regionId: id });

  if (!region) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Region not found',
    });
  }

  return region;
});
