import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/killmail/{id}:
 *   get:
 *     summary: Retrieves a killmail by ID in ESI format.
 *     description: Redirects to /api/killmail/{id}/esi for ESI format.
 *     tags:
 *       - Killmails
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the killmail to retrieve.
 *         schema:
 *           type: integer
 *           example: 113333333
 *     responses:
 *       '307':
 *         description: Temporary redirect to ESI endpoint
 */
export default defineEventHandler(async (event) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  // Redirect to ESI endpoint
  return sendRedirect(event, `/api/killmail/${id}/esi`, 307);
});
