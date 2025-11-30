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
 *             example:
 *               killmail_id: 113333333
 *               killmail_time: "2025-12-01T12:34:56Z"
 *               solar_system_id: 30000142
 *               victim:
 *                 character_id: 95465499
 *                 corporation_id: 98356193
 *                 alliance_id: 933731581
 *                 ship_type_id: 587
 *                 damage_taken: 2850
 *                 position:
 *                   x: 123456789.0
 *                   y: 987654321.0
 *                   z: 456789123.0
 *                 items:
 *                   - item_type_id: 2048
 *                     flag: 5
 *                     quantity_destroyed: 1
 *                     singleton: 0
 *               attackers:
 *                 - character_id: 1234567890
 *                   corporation_id: 98000001
 *                   ship_type_id: 638
 *                   weapon_type_id: 2456
 *                   final_blow: true
 *                   damage_done: 2850
 *                   security_status: 5.0
 *       '404':
 *         description: Killmail not found.
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 404
 *               statusMessage: "Killmail with ID 113333333 not found"
 *       '400':
 *         description: Invalid ID supplied.
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 400
 *               statusMessage: "Invalid killmail ID"
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
