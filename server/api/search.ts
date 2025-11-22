/**
 * Search API endpoint
 * Queries Typesense for characters, corporations, alliances, items, systems, etc.
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
