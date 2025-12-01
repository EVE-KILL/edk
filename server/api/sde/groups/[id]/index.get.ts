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
 *       - SDE - Groups
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The group ID
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       '200':
 *         description: Group details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - groupId
 *                 - categoryId
 *                 - name
 *                 - published
 *               properties:
 *                 groupId:
 *                   type: integer
 *                   description: Unique group identifier
 *                 categoryId:
 *                   type: integer
 *                   description: Parent category ID
 *                 name:
 *                   type: string
 *                   description: Group name
 *                 iconId:
 *                   type: [integer, 'null']
 *                   description: Icon ID
 *                 published:
 *                   type: boolean
 *                   description: Whether group is published
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
