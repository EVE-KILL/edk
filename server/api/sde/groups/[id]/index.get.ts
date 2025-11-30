import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Group } from '~/models/groups';

/**
 * @openapi
 * /api/sde/groups/{id}:
 *   get:
 *     summary: Get group by ID
 *     description: Returns a single group from the Static Data Export.
 *     tags:
 *       - SDE - Types
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The group ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Group details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Group not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The group ID'),
    }),
  });

  const item = await database.findOne<Group>(
    `SELECT * FROM groups WHERE "groupId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Group not found',
    });
  }

  return item;
});
