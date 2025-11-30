import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { AgentType } from '~/models/agentTypes';

/**
 * @openapi
 * /api/sde/agent-types/{id}:
 *   get:
 *     summary: Get agent type by ID
 *     description: Returns a single agent type from the Static Data Export.
 *     tags:
 *       - SDE - NPCs
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The agent type ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: AgentType details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: AgentType not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The agent type ID'),
    }),
  });

  const item = await database.findOne<AgentType>(
    `SELECT * FROM agenttypes WHERE "agentTypeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'AgentType not found',
    });
  }

  return item;
});
