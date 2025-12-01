import { z } from 'zod';
import { validate } from '~/utils/validation';
import { getFilteredKills, type KilllistFilters } from '~/models/killlist';

/**
 * @openapi
 * /api/characters/{id}/killmails:
 *   get:
 *     summary: Get killmails for a character
 *     description: Returns a paginated list of killmails where the character was involved as either victim or attacker.
 *     tags:
 *       - Characters
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The character ID
 *         schema:
 *           type: integer
 *           example: 2115268551
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
 *                         example: "131628709"
 *                       killmailTime:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-30T23:29:19.000Z"
 *                       solarSystemId:
 *                         type: integer
 *                         example: 30000117
 *                       regionId:
 *                         type: integer
 *                         example: 10000001
 *                       security:
 *                         type: number
 *                         example: 0.248619
 *                       victimCharacterId:
 *                         type: string
 *                         example: "2115268551"
 *                       victimCorporationId:
 *                         type: string
 *                         example: "98616128"
 *                       victimAllianceId:
 *                         type: [string, "null"]
 *                         example: "922190997"
 *                       victimShipTypeId:
 *                         type: integer
 *                         example: 670
 *                       victimShipGroupId:
 *                         type: integer
 *                         example: 29
 *                       victimDamageTaken:
 *                         type: integer
 *                         example: 459
 *                       topAttackerCharacterId:
 *                         type: [string, "null"]
 *                         example: "94848671"
 *                       topAttackerCorporationId:
 *                         type: [string, "null"]
 *                         example: "98102892"
 *                       topAttackerAllianceId:
 *                         type: [string, "null"]
 *                         example: "173714703"
 *                       topAttackerShipTypeId:
 *                         type: [integer, "null"]
 *                         example: 29988
 *                       totalValue:
 *                         type: number
 *                         example: 0
 *                       attackerCount:
 *                         type: integer
 *                         example: 1
 *                       npc:
 *                         type: boolean
 *                         example: false
 *                       solo:
 *                         type: boolean
 *                         example: true
 *                       awox:
 *                         type: boolean
 *                         example: false
 *                       entityId:
 *                         type: integer
 *                         example: 0
 *                       entityType:
 *                         type: string
 *                         enum: ["none", "character", "corporation", "alliance"]
 *                         example: "none"
 *                       isVictim:
 *                         type: boolean
 *                         example: false
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 perPage:
 *                   type: integer
 *                   example: 50
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
    bothCharacterIds: [id],
  };

  const killmails = await getFilteredKills(filters, page, perPage);

  return {
    killmails,
    page,
    perPage,
  };
});
