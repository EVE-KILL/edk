import { defineEventHandler, getQuery } from 'h3'
import { typesense } from '~/helpers/typesense'
import { logger } from '~/helpers/logger'

export default defineEventHandler(async (event) => {
  const { q, limit = '20' } = getQuery(event);

  if (!q || typeof q !== 'string') {
    event.res.statusCode = 400
    return { error: 'Search query is required' }
  }

  const searchParameters = {
    q,
    query_by: 'name',
    per_page: parseInt(limit as string, 10),
    group_by: 'type',
    group_limit: 5,
  };

  try {
    const searchResult = await typesense.collections('search').documents().search(searchParameters);

    const groupedResults: Record<string, any[]> = {};

    for (const group of searchResult.grouped_hits || []) {
      const type = group.group_key[0];
      if (type) {
        groupedResults[type] = group.hits.map((hit) => hit.document);
      }
    }

    return groupedResults;
  } catch (error) {
    logger.error('Typesense search error:', { err: error })
    event.res.statusCode = 500
    return { error: 'Search failed' }
  }
})
