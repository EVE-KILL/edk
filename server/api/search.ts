/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Performs a search for EVE Online entities.
 *     description: |
 *       Queries PostgreSQL full-text search for various EVE Online entities, including characters, corporations, alliances, items, and solar systems.
 *       Results are ranked by relevance using ts_rank and trigram similarity.
 *     tags:
 *       - Search
 *     parameters:
 *       - name: q
 *         in: query
 *         required: true
 *         description: The search query string (minimum 2 characters).
 *         schema:
 *           type: string
 *           example: "drake"
 *       - name: limit
 *         in: query
 *         required: false
 *         description: The maximum number of results to return per entity type.
 *         schema:
 *           type: integer
 *           default: 5
 *           maximum: 20
 *     responses:
 *       '200':
 *         description: An object containing the search results.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *             example:
 *               results:
 *                 - id: "95465499"
 *                   name: "Karbowiak"
 *                   type: "character"
 *                   corporationId: 98356193
 *                   allianceId: 933731581
 *                 - id: "98356193"
 *                   name: "Synthetic Systems"
 *                   type: "corporation"
 *                   ticker: "SYNTH"
 *                   allianceId: 933731581
 *                 - id: "638"
 *                   name: "Drake"
 *                   type: "item"
 *                   groupId: 25
 *                   categoryId: 6
 *                 - id: "30000142"
 *                   name: "Jita"
 *                   type: "solarsystem"
 *                   regionId: 10000002
 *                   security: 0.946
 *       '500':
 *         description: Internal server error if the search operation fails.
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 500
 *               statusMessage: "Search failed"
 */
import { defineEventHandler, getQuery } from 'h3';
import { searchEntities } from '~/models/search';
import { logger } from '~/helpers/logger';

export default defineEventHandler(async (event) => {
  const { q, limit = '5' } = getQuery(event);

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return { results: [] };
  }

  try {
    const maxLimit = Math.min(parseInt(limit as string, 10) || 5, 20);
    const results = await searchEntities(q.trim(), maxLimit);

    return { results };
  } catch (error: any) {
    logger.error('Search error:', { err: error, query: q });

    throw createError({
      statusCode: 500,
      statusMessage: 'Search failed',
    });
  }
});
