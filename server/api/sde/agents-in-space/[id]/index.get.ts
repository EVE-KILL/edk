import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { AgentInSpace } from '~/models/agentsInSpace';

/**
 * @openapi
 * /api/sde/agents-in-space/{id}:
 *   get:
 *     summary: Get agent in space by ID
 *     description: Returns a single agent in space from the Static Data Export.
 *     tags:
 *       - SDE - NPCs
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The agent in space ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: AgentInSpace details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: AgentInSpace not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The agent in space ID'),
    }),
  });

  const item = await database.findOne<AgentInSpace>(
    `SELECT * FROM agentsinspace WHERE "agentId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'AgentInSpace not found',
    });
  }

  return item;
});
