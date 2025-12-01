import { z } from 'zod';
import { validate } from '~/utils/validation';
import { getFilteredKills, type KilllistFilters } from '~/models/killlist';

/**
 * @openapi
 * /api/corporations/{id}/killmails:
 *   get:
 *     summary: Get killmails for a corporation
 *     description: Returns a paginated list of killmails where this corporation was involved as either victim or attacker.
 *     tags:
 *       - Corporations
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The corporation ID
 *         schema:
 *           type: integer
 *           example: 98356193
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number (1-indexed)
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - name: perPage
 *         in: query
 *         required: false
 *         description: Number of items per page
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       '200':
 *         description: Paginated list of killmails
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - killmails
 *                 - page
 *                 - perPage
 *               properties:
 *                 killmails:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       killmailId:
 *                         type: string
 *                       killmailTime:
 *                         type: string
 *                         format: date-time
 *                       solarSystemId:
 *                         type: integer
 *                       regionId:
 *                         type: integer
 *                       security:
 *                         type: number
 *                       victimCharacterId:
 *                         type: string
 *                       victimCorporationId:
 *                         type: string
 *                       victimAllianceId:
 *                         type: [string, "null"]
 *                       victimShipTypeId:
 *                         type: integer
 *                       victimShipGroupId:
 *                         type: integer
 *                       victimDamageTaken:
 *                         type: integer
 *                       topAttackerCharacterId:
 *                         type: [string, "null"]
 *                       topAttackerCorporationId:
 *                         type: [string, "null"]
 *                       topAttackerAllianceId:
 *                         type: [string, "null"]
 *                       topAttackerShipTypeId:
 *                         type: [integer, "null"]
 *                       totalValue:
 *                         type: number
 *                       attackerCount:
 *                         type: integer
 *                       npc:
 *                         type: boolean
 *                       solo:
 *                         type: boolean
 *                       awox:
 *                         type: boolean
 *                       entityId:
 *                         type: integer
 *                       entityType:
 *                         type: string
 *                         enum: ["none", "character", "corporation", "alliance"]
 *                       isVictim:
 *                         type: boolean
 *                 page:
 *                   type: integer
 *                 perPage:
 *                   type: integer
 */
export default defineEventHandler(async (event) => {
  const { params, query } = await validate(event, {
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    query: z.object({
      page: z.coerce.number().int().positive().default(1),
      perPage: z.coerce.number().int().positive().max(200).default(50),
    }),
  });

  const { id } = params;
  const { page, perPage } = query;

  const filters: KilllistFilters = {
    bothCorporationIds: [id],
  };

  const killmails = await getFilteredKills(filters, page, perPage);

  return {
    killmails,
    page,
    perPage,
  };
});
