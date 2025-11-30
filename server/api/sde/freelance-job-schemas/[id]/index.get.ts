import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { FreelanceJobSchema } from '~/models/freelanceJobSchemas';

/**
 * @openapi
 * /api/sde/freelance-job-schemas/{id}:
 *   get:
 *     summary: Get freelance job schema by ID
 *     description: Returns a single freelance job schema from the Static Data Export.
 *     tags:
 *       - SDE - Miscellaneous
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The freelance job schema ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: FreelanceJobSchema details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: FreelanceJobSchema not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The freelance job schema ID'),
    }),
  });

  const item = await database.findOne<FreelanceJobSchema>(
    `SELECT * FROM freelancejobschemas WHERE "schemaId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'FreelanceJobSchema not found',
    });
  }

  return item;
});
