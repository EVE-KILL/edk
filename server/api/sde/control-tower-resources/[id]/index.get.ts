import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { ControlTowerResource } from '~/models/controlTowerResources';

/**
 * @openapi
 * /api/sde/control-tower-resources/{id}:
 *   get:
 *     summary: Get control tower resource by ID
 *     description: Returns a single control tower resource from the Static Data Export.
 *     tags:
 *       - SDE - Structures
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The control tower resource ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: ControlTowerResource details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: ControlTowerResource not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The control tower resource ID'),
    }),
  });

  const item = await database.findOne<ControlTowerResource>(
    `SELECT * FROM controltowerresources WHERE "controlTowerTypeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'ControlTowerResource not found',
    });
  }

  return item;
});
