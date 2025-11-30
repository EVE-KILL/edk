import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { SkinMaterial } from '~/models/skinMaterials';

/**
 * @openapi
 * /api/sde/skin-materials/{id}:
 *   get:
 *     summary: Get skin material by ID
 *     description: Returns a single skin material from the Static Data Export.
 *     tags:
 *       - SDE - Cosmetics
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The skin material ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: SkinMaterial details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: SkinMaterial not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The skin material ID'),
    }),
  });

  const item = await database.findOne<SkinMaterial>(
    `SELECT * FROM skinmaterials WHERE "skinMaterialId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'SkinMaterial not found',
    });
  }

  return item;
});
