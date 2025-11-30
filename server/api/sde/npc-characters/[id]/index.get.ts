import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { NpcCharacter } from '~/models/npcCharacters';

/**
 * @openapi
 * /api/sde/npc-characters/{id}:
 *   get:
 *     summary: Get NPC character by ID
 *     description: Returns a single NPC character from the Static Data Export.
 *     tags:
 *       - SDE - NPCs
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The NPC character ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: NpcCharacter details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: NpcCharacter not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The NPC character ID'),
    }),
  });

  const item = await database.findOne<NpcCharacter>(
    `SELECT * FROM npccharacters WHERE "characterId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'NpcCharacter not found',
    });
  }

  return item;
});
