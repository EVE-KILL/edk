import { z } from 'zod';
import { validate } from '~/utils/validation';
import { getFilteredKills, type KilllistFilters } from '~/models/killlist';

/**
 * @openapi
 * /api/factions/{id}/killmails:
 *   get:
 *     summary: Get killmails for a faction
 *     description: Returns killmails where the faction was involved (victim faction wars).
 *     tags:
 *       - Factions
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The faction ID
 *         schema:
 *           type: integer
 *           example: 500001
 *       - name: page
 *         in: query
 *         description: Page number
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: perPage
 *         in: query
 *         description: Items per page (max 200)
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *     responses:
 *       '200':
 *         description: List of killmails
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
    victimFactionIds: [id],
  };

  const killmails = await getFilteredKills(filters, page, perPage);

  return {
    killmails,
    page,
    perPage,
  };
});
