/**
 * Unified search model using PostgreSQL full-text search
 * Replaces Typesense with native PostgreSQL capabilities
 */

import { database } from '../helpers/database';

export interface SearchResult {
  id: string;
  entityId: string;
  name: string;
  type: string;
  rawId: string;
  similarity?: number;
}

/**
 * Search across multiple entity types using PostgreSQL full-text search
 * Optimized for performance with simpler matching strategy
 * @param query Search query string
 * @param limit Maximum results per entity type (default 5)
 * @returns Array of search results grouped by type
 */
export async function searchEntities(
  query: string,
  limit: number = 5
): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.trim();
  const prefixPattern = `${searchTerm}%`; // Prefix match only for index performance

  // Prefix-only search for optimal index usage
  // Uses functional index on LOWER(name) with text_pattern_ops
  const results = await database.find<{
    id: string;
    name: string;
    type: string;
    rank: number;
  }>(
    `
    (
      SELECT
        "characterId"::text as id,
        name,
        'character' as type,
        1 as rank
      FROM characters
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "corporationId"::text as id,
        name,
        'corporation' as type,
        1 as rank
      FROM corporations
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "allianceId"::text as id,
        name,
        'alliance' as type,
        1 as rank
      FROM alliances
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "typeId"::text as id,
        name,
        'item' as type,
        1 as rank
      FROM types
      WHERE 
        name IS NOT NULL 
        AND "published" = true 
        AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "solarSystemId"::text as id,
        name,
        'system' as type,
        1 as rank
      FROM solarsystems
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "constellationId"::text as id,
        name,
        'constellation' as type,
        1 as rank
      FROM constellations
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "regionId"::text as id,
        name,
        'region' as type,
        1 as rank
      FROM regions
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name
      LIMIT :limit
    )
    ORDER BY name
    `,
    { searchTerm, prefixPattern, limit }
  );

  // Transform to SearchResult format
  return results.map((row) => ({
    id: row.id,
    entityId: row.id,
    name: row.name,
    type: row.type,
    rawId: `${row.type}-${row.id}`,
    similarity: row.rank,
  }));
}
