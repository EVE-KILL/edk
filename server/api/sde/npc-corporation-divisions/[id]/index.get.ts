import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { NpcCorporationDivision } from '~/models/npcCorporationDivisions';

/**
 * @openapi
 * /api/sde/npc-corporation-divisions/{id}:
 *   get:
 *     summary: Get NPC corporation division by ID
 *     description: Returns a single NPC corporation division from the Static Data Export.
 *     tags:
 *       - SDE - NPCs
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The NPC corporation division ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: NpcCorporationDivision details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: NpcCorporationDivision not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The NPC corporation division ID'),
    }),
  });

  const item = await database.findOne<NpcCorporationDivision>(
    `SELECT * FROM npccorporationdivisions WHERE "divisionId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'NpcCorporationDivision not found',
    });
  }

  return item;
});
