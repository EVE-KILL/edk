import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Bloodline } from '~/models/bloodlines';

/**
 * @openapi
 * /api/sde/bloodlines/{id}:
 *   get:
 *     summary: Get bloodline by ID
 *     description: Returns a single bloodline from the Static Data Export.
 *     tags:
 *       - SDE - Bloodlines
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The bloodline ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Bloodline details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - bloodlineId
 *                 - raceId
 *                 - name
 *                 - corporationId
 *               properties:
 *                 bloodlineId:
 *                   type: integer
 *                   description: Unique bloodline identifier
 *                 raceId:
 *                   type: integer
 *                   description: Parent race ID
 *                 name:
 *                   type: string
 *                   description: Bloodline name
 *                 description:
 *                   type: string
 *                   description: Bloodline description
 *                 corporationId:
 *                   type: integer
 *                   description: Starting corporation ID
 *                 charisma:
 *                   type: [integer, 'null']
 *                   description: Charisma attribute bonus
 *                 constitution:
 *                   type: [integer, 'null']
 *                   description: Constitution attribute bonus
 *                 intelligence:
 *                   type: [integer, 'null']
 *                   description: Intelligence attribute bonus
 *                 memory:
 *                   type: [integer, 'null']
 *                   description: Memory attribute bonus
 *                 perception:
 *                   type: [integer, 'null']
 *                   description: Perception attribute bonus
 *                 willpower:
 *                   type: [integer, 'null']
 *                   description: Willpower attribute bonus
 *                 shipTypeId:
 *                   type: [integer, 'null']
 *                   description: Starting ship type ID
 *       '404':
 *         description: Bloodline not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The bloodline ID'),
    }),
  });

  const item = await database.findOne<Bloodline>(
    `SELECT * FROM bloodlines WHERE "bloodlineId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Bloodline not found',
    });
  }

  return item;
});
