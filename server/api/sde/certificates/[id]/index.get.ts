import { z } from 'zod';
import { validate } from '~/utils/validation';
import type { Certificate } from '~/models/certificates';

/**
 * @openapi
 * /api/sde/certificates/{id}:
 *   get:
 *     summary: Get certificate by ID
 *     description: Returns a single certificate from the Static Data Export.
 *     tags:
 *       - SDE - Skills
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The certificate ID
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Certificate details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       '404':
 *         description: Certificate not found
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive().describe('The certificate ID'),
    }),
  });

  const item = await database.findOne<Certificate>(
    `SELECT * FROM certificates WHERE "certificateId" = :id`,
    { id: params.id }
  );

  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Certificate not found',
    });
  }

  return item;
});
