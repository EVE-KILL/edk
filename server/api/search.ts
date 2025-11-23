/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Performs a search for EVE Online entities.
 *     description: |
 *       Queries the Typesense search index for various EVE Online entities, including characters, corporations, alliances, items, and solar systems.
 *       Results are grouped by entity type.
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
 *         description: The maximum number of results to return per group.
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
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
import { typesense } from '~/helpers/typesense';
import { logger } from '~/helpers/logger';

export default defineEventHandler(async (event) => {
  const { q, limit = '20' } = getQuery(event);

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return {};
  }

  try {
    const searchParameters = {
      q: q.trim(),
      query_by: 'name',
      per_page: Math.min(parseInt(limit as string, 10), 50),
      group_by: 'type',
      group_limit: 5,
      sort_by: 'name:asc',
    };

    const searchResult = await typesense
      .collections('search')
      .documents()
      .search(searchParameters);

    const results: any[] = [];

    for (const group of searchResult.grouped_hits || []) {
      const type = group.group_key[0];
      if (!type) continue;

      for (const hit of group.hits) {
        const doc = hit.document as any;
        const rawId = doc.id as string;
        const entityId =
          typeof rawId === 'string' ? rawId.replace(`${type}-`, '') : rawId;

        results.push({
          id: entityId,
          entityId,
          name: doc.name,
          type: doc.type ?? type,
          rawId: rawId,
        });
      }
    }

    return { results };
  } catch (error: any) {
    logger.error('Typesense search error:', { err: error });

    // If collection doesn't exist, return empty results
    if (error.httpStatus === 404) {
      return {};
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Search failed',
    });
  }
});
