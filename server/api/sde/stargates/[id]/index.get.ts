import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Stargate } from '~/models/stargates';

/**
 * @openapi
 * /api/sde/stargates/{id}:
 *   get:
 *     summary: Get stargate by ID
 *     description: Returns a single stargate from the Static Data Export.
 *     tags:
 *       - SDE - Map
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The stargate ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Stargate details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Stargate not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The stargate ID'),
    }),
  });

  const item = await database.findOne<Stargate>(
    `SELECT * FROM stargates WHERE "stargateId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Stargate not found',
    });
  }

  return item;
});
