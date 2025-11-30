import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { SkinLicense } from '~/models/skinLicenses';

/**
 * @openapi
 * /api/sde/skin-licenses/{id}:
 *   get:
 *     summary: Get skin license by ID
 *     description: Returns a single skin license from the Static Data Export.
 *     tags:
 *       - SDE - Cosmetics
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The skin license ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: SkinLicense details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: SkinLicense not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The skin license ID'),
    }),
  });

  const item = await database.findOne<SkinLicense>(
    `SELECT * FROM skinlicenses WHERE "licenseTypeId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'SkinLicense not found',
    });
  }

  return item;
});
