import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Faction } from '~/models/factions';

/**
 * @openapi
 * /api/sde/factions/{id}:
 *   get:
 *     summary: Get faction by ID
 *     description: Returns a single faction from the Static Data Export.
 *     tags:
 *       - SDE - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The faction ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Faction details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Faction not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The faction ID'),
    }),
  });

  const item = await database.findOne<Faction>(
    `SELECT * FROM factions WHERE "factionId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Faction not found',
    });
  }

  return item;
});
