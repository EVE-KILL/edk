import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { NpcStation } from '~/models/npcStations';

/**
 * @openapi
 * /api/sde/npc-stations/{id}:
 *   get:
 *     summary: Get NPC station by ID
 *     description: Returns a single NPC station from the Static Data Export.
 *     tags:
 *       - SDE - NPCs
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The NPC station ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: NpcStation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: NpcStation not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The NPC station ID'),
    }),
  });

  const item = await database.findOne<NpcStation>(
    `SELECT * FROM npcstations WHERE "stationId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'NpcStation not found',
    });
  }

  return item;
});
