import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { PlanetSchematic } from '~/models/planetSchematics';

/**
 * @openapi
 * /api/sde/planet-schematics/{id}:
 *   get:
 *     summary: Get planet schematic by ID
 *     description: Returns a single planet schematic from the Static Data Export.
 *     tags:
 *       - SDE - Planetary
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The planet schematic ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: PlanetSchematic details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: PlanetSchematic not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce
        .number()
        .int()
        .positive()
        .describe('The planet schematic ID'),
    }),
  });

  const item = await database.findOne<PlanetSchematic>(
    `SELECT * FROM planetschematics WHERE "schematicId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'PlanetSchematic not found',
    });
  }

  return item;
});
