import { z } from 'zod';
import { validate } from '~/utils/validation';
import { env } from '../../../../helpers/env';

/**
 * @openapi
 * /api/killmail/{id}/esi:
 *   get:
 *     summary: Retrieve a killmail by ID in ESI format
 *     description: Fetches a single killmail from the database and returns it in the ESI (EVE Swagger Interface) JSON format, matching the official ESI API structure.
 *     tags:
 *       - Killmails
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The unique identifier of the killmail
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       '200':
 *         description: Killmail data in ESI format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - killmail_id
 *                 - killmail_time
 *                 - solar_system_id
 *                 - victim
 *                 - attackers
 *               properties:
 *                 killmail_id:
 *                   type: string
 *                   example: "1"
 *                 killmail_time:
 *                   type: string
 *                   format: date-time
 *                   example: "2007-12-05T12:10:00.000Z"
 *                 solar_system_id:
 *                   type: integer
 *                   example: 30000380
 *                 victim:
 *                   type: object
 *                   required:
 *                     - character_id
 *                     - corporation_id
 *                     - ship_type_id
 *                     - damage_taken
 *                   properties:
 *                     character_id:
 *                       type: string
 *                       example: "1025944883"
 *                     corporation_id:
 *                       type: string
 *                       example: "109299958"
 *                     alliance_id:
 *                       type: [string, "null"]
 *                       example: null
 *                     faction_id:
 *                       type: [integer, "null"]
 *                       example: null
 *                     ship_type_id:
 *                       type: integer
 *                       example: 645
 *                     damage_taken:
 *                       type: integer
 *                       example: 12271
 *                     position:
 *                       type: object
 *                       properties:
 *                         x:
 *                           type: [number, "null"]
 *                         y:
 *                           type: [number, "null"]
 *                         z:
 *                           type: [number, "null"]
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           item_type_id:
 *                             type: integer
 *                           flag:
 *                             type: integer
 *                           quantity_dropped:
 *                             type: integer
 *                           quantity_destroyed:
 *                             type: integer
 *                           singleton:
 *                             type: integer
 *                 attackers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       character_id:
 *                         type: [string, "null"]
 *                       corporation_id:
 *                         type: string
 *                       alliance_id:
 *                         type: [string, "null"]
 *                       faction_id:
 *                         type: [integer, "null"]
 *                       ship_type_id:
 *                         type: [integer, "null"]
 *                       weapon_type_id:
 *                         type: [integer, "null"]
 *                       damage_done:
 *                         type: integer
 *                       final_blow:
 *                         type: boolean
 *                       security_status:
 *                         type: number
 *       '404':
 *         description: Killmail not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 404
 *                 statusMessage:
 *                   type: string
 *                   example: "Killmail with ID 999999 not found"
 *       '400':
 *         description: Invalid killmail ID format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *                 statusMessage:
 *                   type: string
 *                   example: "Invalid killmail ID"
 */
export default defineCachedEventHandler(
  async (event: any) => {
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
  },
  {
    maxAge: 3600,
    staleMaxAge: 3600,
    base: 'redis',
    shouldBypassCache: () => env.NODE_ENV !== 'production',
  }
);
