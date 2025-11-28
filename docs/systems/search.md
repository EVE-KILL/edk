# Search System

EVE-KILL uses PostgreSQL's `pg_trgm` extension for full-text search across entities (characters, corporations, alliances, and solar systems).

## Overview

The search system provides:

- Fast similarity-based search using trigram indexes
- Search across multiple entity types simultaneously
- Ranking by relevance (similarity score)
- Efficient for partial matches and typos

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    Search Request                         │
│  User types query: "Goonswarm"                           │
└─────────────────────┬────────────────────────────────────┘
                      ▼
         ┌────────────────────────┐
         │  Search API Endpoint   │
         │  /api/search?q=query   │
         └────────────┬───────────┘
                      ▼
         ┌────────────────────────────┐
         │  Parallel Searches         │
         │  ┌──────────────────────┐  │
         │  │  Characters          │  │
         │  │  (name search)       │  │
         │  ├──────────────────────┤  │
         │  │  Corporations        │  │
         │  │  (name/ticker)       │  │
         │  ├──────────────────────┤  │
         │  │  Alliances           │  │
         │  │  (name/ticker)       │  │
         │  ├──────────────────────┤  │
         │  │  Solar Systems       │  │
         │  │  (name search)       │  │
         │  └──────────────────────┘  │
         └────────────┬───────────────┘
                      ▼
         ┌────────────────────────┐
         │  Merge & Sort Results  │
         │  - By similarity score │
         │  - By entity type      │
         │  - Limit results       │
         └────────────┬───────────┘
                      ▼
         ┌────────────────────────┐
         │  Return JSON Response  │
         │  [                     │
         │    { type, id, name,   │
         │      similarity },     │
         │    ...                 │
         │  ]                     │
         └────────────────────────┘
```

## PostgreSQL pg_trgm Extension

### What is pg_trgm?

The `pg_trgm` module provides functions and operators for determining the similarity of text based on trigram matching. A trigram is a group of three consecutive characters.

**Example**: "hello"

- Trigrams: " h", " he", "hel", "ell", "llo", "lo "

### Similarity Operator

```sql
SELECT name, similarity(name, 'Goonswarm') AS sim
FROM alliances
WHERE name % 'Goonswarm'  -- % is the similarity operator
ORDER BY sim DESC
LIMIT 10;
```

The `%` operator returns true when similarity score > 0.3 (configurable).

### GIN Indexes

Trigram indexes are created using GIN (Generalized Inverted Index):

```sql
CREATE INDEX idx_characters_name_trgm
  ON characters USING gin(name gin_trgm_ops);

CREATE INDEX idx_corporations_name_trgm
  ON corporations USING gin(name gin_trgm_ops);

CREATE INDEX idx_corporations_ticker_trgm
  ON corporations USING gin(ticker gin_trgm_ops);

CREATE INDEX idx_alliances_name_trgm
  ON alliances USING gin(name gin_trgm_ops);

CREATE INDEX idx_alliances_ticker_trgm
  ON alliances USING gin(ticker gin_trgm_ops);
```

These indexes make similarity searches very fast, even on millions of rows.

## Search Implementation

### Search Model (`server/models/search.ts`)

```typescript
export interface SearchResult {
  type: 'character' | 'corporation' | 'alliance' | 'solarSystem';
  id: number;
  name: string;
  ticker?: string;
  similarity: number;
}

export async function searchAll(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const sql = database.sql;

  const [characters, corporations, alliances, solarSystems] = await Promise.all(
    [
      searchCharacters(query, limit),
      searchCorporations(query, limit),
      searchAlliances(query, limit),
      searchSolarSystems(query, limit),
    ]
  );

  // Merge and sort by similarity
  const all = [...characters, ...corporations, ...alliances, ...solarSystems];
  all.sort((a, b) => b.similarity - a.similarity);

  return all.slice(0, limit);
}
```

### Entity-Specific Searches

**Characters**:

```typescript
export async function searchCharacters(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  return database.query<SearchResult>(
    `SELECT 
       'character' as type,
       id,
       name,
       similarity(name, :query) as similarity
     FROM characters
     WHERE name % :query
       AND deleted = false
     ORDER BY similarity DESC
     LIMIT :limit`,
    { query, limit }
  );
}
```

**Corporations** (searches both name and ticker):

```typescript
export async function searchCorporations(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  return database.query<SearchResult>(
    `SELECT 
       'corporation' as type,
       id,
       name,
       ticker,
       GREATEST(
         similarity(name, :query),
         similarity(ticker, :query)
       ) as similarity
     FROM corporations
     WHERE (name % :query OR ticker % :query)
       AND deleted = false
     ORDER BY similarity DESC
     LIMIT :limit`,
    { query, limit }
  );
}
```

**Alliances** (similar to corporations):

```typescript
export async function searchAlliances(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  return database.query<SearchResult>(
    `SELECT 
       'alliance' as type,
       id,
       name,
       ticker,
       GREATEST(
         similarity(name, :query),
         similarity(ticker, :query)
       ) as similarity
     FROM alliances
     WHERE (name % :query OR ticker % :query)
       AND deleted = false
     ORDER BY similarity DESC
     LIMIT :limit`,
    { query, limit }
  );
}
```

**Solar Systems**:

```typescript
export async function searchSolarSystems(
  query: string,
  limit: number = 10
): Promise<SearchResult[]> {
  return database.query<SearchResult>(
    `SELECT 
       'solarSystem' as type,
       "solarSystemID" as id,
       "solarSystemName" as name,
       similarity("solarSystemName", :query) as similarity
     FROM "mapSolarSystems"
     WHERE "solarSystemName" % :query
     ORDER BY similarity DESC
     LIMIT :limit`,
    { query, limit }
  );
}
```

## Search API

### Endpoint

`GET /api/search?q=<query>&limit=<limit>`

**Parameters**:

- `q` (required): Search query string
- `limit` (optional): Max results (default: 10, max: 50)
- `type` (optional): Filter by entity type (character, corporation, alliance, solarSystem)

### Response Format

```json
{
  "results": [
    {
      "type": "alliance",
      "id": 1354830081,
      "name": "Goonswarm Federation",
      "ticker": "CONDI",
      "similarity": 0.923077
    },
    {
      "type": "corporation",
      "id": 1344654522,
      "name": "Goonswarm Cloaking Team",
      "ticker": "CLOAK",
      "similarity": 0.857143
    }
  ],
  "count": 2,
  "query": "Goonswarm",
  "limit": 10
}
```

### Example Usage

```bash
# Search all entities
curl "https://eve-kill.com/api/search?q=Goonswarm"

# Search corporations only
curl "https://eve-kill.com/api/search?q=Goonswarm&type=corporation"

# Limit results
curl "https://eve-kill.com/api/search?q=Jita&limit=5"
```

## Frontend Integration

### Search Input Component

The search component (`templates/default/components/search-input.hbs`) provides:

- Auto-complete as user types
- Debounced API calls (300ms)
- Grouped results by entity type
- Keyboard navigation (arrow keys, enter)

### JavaScript Implementation

```javascript
const searchInput = document.querySelector('#search-input');
const resultsContainer = document.querySelector('#search-results');

let debounceTimer;

searchInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(async () => {
    const query = e.target.value.trim();

    if (query.length < 2) {
      resultsContainer.innerHTML = '';
      return;
    }

    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}&limit=10`
    );
    const data = await response.json();

    renderResults(data.results);
  }, 300);
});

function renderResults(results) {
  const grouped = groupByType(results);

  resultsContainer.innerHTML = Object.entries(grouped)
    .map(
      ([type, items]) => `
      <div class="search-group">
        <div class="search-group-title">${type}s</div>
        ${items
          .map(
            (item) => `
          <a href="/${type}/${item.id}" class="search-result">
            <img src="${getIconUrl(type, item.id)}" alt="${item.name}" />
            <span>${item.name}</span>
            ${item.ticker ? `<span class="ticker">[${item.ticker}]</span>` : ''}
          </a>
        `
          )
          .join('')}
      </div>
    `
    )
    .join('');
}
```

## Performance Optimization

### Index Maintenance

Trigram indexes are automatically maintained but can become bloated:

```sql
-- Rebuild indexes periodically
REINDEX INDEX idx_characters_name_trgm;
REINDEX INDEX idx_corporations_name_trgm;
REINDEX INDEX idx_alliances_name_trgm;
```

Automated via cron job:

```bash
bun cli db:reindex-search
```

### Query Optimization

**Do's**:

- Always use `similarity()` in SELECT and ORDER BY
- Filter deleted entities (`deleted = false`)
- Limit results appropriately
- Use parallel searches for multiple entity types

**Don'ts**:

- Don't search without minimum query length (< 2 chars)
- Don't set similarity threshold too low (< 0.2)
- Don't forget to use the similarity operator (`%`)

### Caching

Search results are cached in Redis for 5 minutes:

```typescript
const cacheKey = `search:${query}:${limit}:${type}`;
const cached = await cache.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const results = await searchAll(query, limit);
await cache.set(cacheKey, JSON.stringify(results), 300); // 5 minutes

return results;
```

## Similarity Threshold

The default similarity threshold is 0.3. Adjust with:

```sql
SET pg_trgm.similarity_threshold = 0.3;
```

**Recommendations**:

- **0.2**: Very loose matching (more results, lower relevance)
- **0.3**: Balanced (default, good for most cases)
- **0.4**: Strict matching (fewer results, higher relevance)

## Advanced Features

### Fuzzy Matching

Trigram search automatically handles:

- Typos: "Gonswarm" → "Goonswarm"
- Partial matches: "Goons" → "Goonswarm Federation"
- Case insensitivity: "goonswarm" → "Goonswarm"

### Multi-Field Search

For corporations and alliances, search both name and ticker:

```sql
WHERE (name % :query OR ticker % :query)
ORDER BY GREATEST(
  similarity(name, :query),
  similarity(ticker, :query)
) DESC
```

This ensures "CONDI" finds "Goonswarm Federation" by ticker.

### Weighted Results

Boost results based on additional criteria:

```sql
SELECT
  id,
  name,
  similarity(name, :query) *
    CASE
      WHEN "memberCount" > 1000 THEN 1.2
      WHEN "memberCount" > 100 THEN 1.1
      ELSE 1.0
    END as weighted_similarity
FROM corporations
WHERE name % :query
ORDER BY weighted_similarity DESC;
```

## Monitoring

### Search Analytics

Track search queries for insights:

```typescript
await database.insert('search_analytics', {
  query,
  resultCount: results.length,
  type: type || 'all',
  timestamp: new Date(),
});
```

### Performance Metrics

Monitor:

- Average search latency
- Cache hit rate
- Most common queries
- Queries with no results

## CLI Commands

```bash
# Rebuild search indexes
bun cli db:reindex-search

# Test search
bun cli debug:search "Goonswarm"

# Search analytics
bun cli stats:search-queries --top 10
```

## Troubleshooting

### Slow Searches

1. Check if indexes exist: `\d+ characters`
2. Rebuild indexes: `REINDEX INDEX idx_characters_name_trgm`
3. Vacuum tables: `VACUUM ANALYZE characters`

### No Results

1. Check similarity threshold: `SHOW pg_trgm.similarity_threshold`
2. Try lowering threshold temporarily
3. Check if entity exists and is not deleted

### Too Many False Positives

1. Increase similarity threshold to 0.4 or 0.5
2. Add additional filters (e.g., minimum member count)
3. Use weighted similarity scoring
