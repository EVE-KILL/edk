import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/wars/{id}:
 *   get:
 *     summary: Get war details
 *     description: Returns war information from the database.
 *     tags:
 *       - Wars
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The war ID
 *         schema:
 *           type: integer
 *           example: 615476
 *     responses:
 *       '200':
 *         description: War details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               warId: 615476
 *               aggressorId: 98356193
 *               aggressorType: "corporation"
 *               defenderId: 98000001
 *               defenderType: "corporation"
 *               declared: "2025-11-15T12:00:00.000Z"
 *               started: "2025-11-16T12:00:00.000Z"
 *               finished: null
 *               mutual: false
 *               openForAllies: true
 *               retracted: null
 *               updatedAt: "2025-12-01T10:30:45.000Z"
 *       '404':
 *         description: War not found
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 404
 *               statusMessage: "War not found"
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const war = await database.findOne('wars', { warId: id });

  if (!war) {
    throw createError({
      statusCode: 404,
      statusMessage: 'War not found',
    });
  }

  return war;
});
