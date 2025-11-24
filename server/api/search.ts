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
 *       '500':
 *         description: Internal server error if the search operation fails.
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
