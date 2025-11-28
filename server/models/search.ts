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
  memberCount?: number | null;
  ticker?: string | null;
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
  // Deduplicates by name, keeping only the most recently created entity
  const results = await database.find<{
    id: string;
    name: string;
    type: string;
    memberCount?: number | null;
    ticker?: string | null;
    rank: number;
  }>(
    `
    (
      SELECT DISTINCT ON (name)
        "characterId"::text as id,
        name,
        'character' as type,
        NULL::int as "memberCount",
        NULL::text as ticker,
        1 as rank
      FROM characters
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name, "birthday" DESC NULLS LAST
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT DISTINCT ON (name)
        "corporationId"::text as id,
        name,
        'corporation' as type,
        "memberCount",
        ticker,
        1 as rank
      FROM corporations
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name, "dateFounded" DESC NULLS LAST
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT DISTINCT ON (name)
        "allianceId"::text as id,
        name,
        'alliance' as type,
        COALESCE((
          SELECT SUM(c."memberCount") FROM corporations c WHERE c."allianceId" = alliances."allianceId"
        ), 0) as "memberCount",
        ticker,
        1 as rank
      FROM alliances
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY name, "dateFounded" DESC NULLS LAST
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        t."typeId"::text as id,
        t.name,
        'item' as type,
        NULL::int as "memberCount",
        NULL::text as ticker,
        1 as rank
      FROM types t
      INNER JOIN groups g ON t."groupId" = g."groupId"
      INNER JOIN categories c ON g."categoryId" = c."categoryId"
      WHERE
        t.name IS NOT NULL
        AND t."published" = true
        AND g."published" = true
        AND c."published" = true
        AND c."categoryId" != 9
        AND t.name NOT ILIKE '%blueprint%'
        AND LOWER(t.name) LIKE LOWER(:prefixPattern)
      ORDER BY t."name"
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "solarSystemId"::text as id,
        name,
        'system' as type,
        NULL::int as "memberCount",
        NULL::text as ticker,
        1 as rank
      FROM solarsystems
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY "name"
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "constellationId"::text as id,
        name,
        'constellation' as type,
        NULL::int as "memberCount",
        NULL::text as ticker,
        1 as rank
      FROM constellations
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY "name"
      LIMIT :limit
    )
    UNION ALL
    (
      SELECT
        "regionId"::text as id,
        name,
        'region' as type,
        NULL::int as "memberCount",
        NULL::text as ticker,
        1 as rank
      FROM regions
      WHERE name IS NOT NULL AND LOWER(name) LIKE LOWER(:prefixPattern)
      ORDER BY "name"
      LIMIT :limit
    )
    ORDER BY "name"
    `,
    { searchTerm, prefixPattern, limit }
  );

  // Transform to SearchResult format
  return results.map((row) => ({
    id: row.id,
    entityId: row.id,
    name: row.name,
    type: row.type,
    rawId: row.id,
    similarity: row.rank,
    memberCount: row.memberCount ?? null,
    ticker: row.ticker ?? null,
  }));
}
