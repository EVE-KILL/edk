import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { NpcCorporation } from '~/models/npcCorporations';

/**
 * @openapi
 * /api/sde/npc-corporations/{id}:
 *   get:
 *     summary: Get NPC corporation by ID
 *     description: Returns a single NPC corporation from the Static Data Export.
 *     tags:
 *       - SDE - NPCs
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The NPC corporation ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: NpcCorporation details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: NpcCorporation not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The NPC corporation ID'),
    }),
  });

  const item = await database.findOne<NpcCorporation>(
    `SELECT * FROM npccorporations WHERE "corporationId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'NpcCorporation not found',
    });
  }

  return item;
});
