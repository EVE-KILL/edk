import { z } from 'zod';
import { validate } from '~/utils/validation';
import { getFilteredKills, type KilllistFilters } from '~/models/killlist';

/**
 * @openapi
 * /api/solarsystems/{id}/killmails:
 *   get:
 *     summary: Get killmails for a solar system
 *     description: Returns killmails that occurred in this solar system.
 *     tags:
 *       - Solar Systems
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The solar system ID
 *         schema:
 *           type: integer
 *           example: 30000142
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
    solarSystemId: id,
  };

  const killmails = await getFilteredKills(filters, page, perPage);

  return {
    killmails,
    page,
    perPage,
  };
});
