import { z } from 'zod';
import { validate } from '~/utils/validation';

/**
 * @openapi
 * /api/killmail/{id}/esi:
 *   get:
 *     summary: Retrieves a killmail by ID in ESI format.
 *     description: Fetches a single killmail from the database and returns it in the ESI (EVE Swagger Interface) JSON format.
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
 *       '200':
 *         description: The killmail data in ESI format.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 killmail_id:
 *                   type: integer
 *                 killmail_time:
 *                   type: string
 *                   format: date-time
 *                 solar_system_id:
 *                   type: integer
 *       '404':
 *         description: Killmail not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Killmail with ID 12345 not found"
 *       '400':
 *         description: Invalid ID supplied.
 */
export default defineEventHandler(async (event: any) => {
  const { params } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
  });

  const { id } = params;

  const killmail = await getKillmail(id);

  if (!killmail) {
    throw createError({
      statusCode: 404,
      statusMessage: `Killmail with ID ${id} not found`,
    });
  }

  return killmail;
});
