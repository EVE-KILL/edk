import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { DogmaUnit } from '~/models/dogmaUnits';

/**
 * @openapi
 * /api/sde/dogma-units/{id}:
 *   get:
 *     summary: Get dogma unit by ID
 *     description: Returns a single dogma unit from the Static Data Export.
 *     tags:
 *       - SDE - Dogma
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The dogma unit ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: DogmaUnit details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: DogmaUnit not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The dogma unit ID'),
    }),
  });

  const item = await database.findOne<DogmaUnit>(
    `SELECT * FROM dogmaunits WHERE "unitId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'DogmaUnit not found',
    });
  }

  return item;
});
