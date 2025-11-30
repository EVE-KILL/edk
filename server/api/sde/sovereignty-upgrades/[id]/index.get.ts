import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { SovereigntyUpgrade } from '~/models/sovereigntyUpgrades';

/**
 * @openapi
 * /api/sde/sovereignty-upgrades/{id}:
 *   get:
 *     summary: Get sovereignty upgrade by ID
 *     description: Returns a single sovereignty upgrade from the Static Data Export.
 *     tags:
 *       - SDE - Sovereignty
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The sovereignty upgrade ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: SovereigntyUpgrade details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: SovereigntyUpgrade not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The sovereignty upgrade ID'),
    }),
  });

  const item = await database.findOne<SovereigntyUpgrade>(
    `SELECT * FROM sovereigntyupgrades WHERE "upgradeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'SovereigntyUpgrade not found',
    });
  }

  return item;
});
