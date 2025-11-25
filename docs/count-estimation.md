# Fast Count Estimation for Pagination

## Overview

Traditional `COUNT(*)` queries are extremely expensive on large tables, often taking 5-30 seconds to scan millions of rows. For pagination display, users don't need exact counts - they just want to know roughly how many pages exist.

This document describes the EXPLAIN-based count estimation system that provides **100-1000x faster** count approximations.

## The Problem

```typescript
// ❌ SLOW: Scans all matching rows
const total = await database.sql`
  SELECT COUNT(*) FROM killmails 
  WHERE "killmailTime" > NOW() - INTERVAL '7 days'
`;
// Time: 5-30 seconds on millions of rows
```

## The Solution

```typescript
// ✅ FAST: Uses query planner's estimate
const total = await estimateCount(database.sql`
  SELECT 1 FROM killmails 
  WHERE "killmailTime" > NOW() - INTERVAL '7 days'
`);
// Time: 5-50 milliseconds
```

## How It Works

PostgreSQL's query planner calculates row estimates for every query using:
- Table statistics (from ANALYZE)
- Index selectivity
- Filter condition estimates
- Histogram data

We extract this estimate via `EXPLAIN (FORMAT JSON)` without executing the actual query.

## API Reference

### `estimateCount(queryFragment)`

Extract row count estimate from PostgreSQL's query planner.

```typescript
import { estimateCount } from '../helpers/count-estimate';

const estimate = await estimateCount(database.sql`
  SELECT 1 FROM killmails 
  WHERE "regionId" = ${regionId}
    AND "killmailTime" > ${startDate}
`);
// Returns: ~23450 (fast, no table scan)
```

**Parameters:**
- `queryFragment`: A `database.sql` tagged template query

**Returns:** `Promise<number>` - Estimated row count (rounded to nearest integer)

**Accuracy:** Usually within 10-50% of exact count

**Performance:** 5-50ms regardless of table size

### `getTableEstimate(tableName)`

Get unfiltered row count estimate from pg_class metadata.

```typescript
import { getTableEstimate } from '../helpers/count-estimate';

// Single table
const count = await getTableEstimate('killmails_2025');

// All partitions with pattern
const total = await getTableEstimate('killmails_%');
```

**Parameters:**
- `tableName`: Table name or pattern (use `%` for wildcard)

**Returns:** `Promise<number>` - Estimated total rows

**Performance:** <1ms (metadata lookup)

### `formatCount(count, isEstimate)`

Format count for display with approximate indicator.

```typescript
import { formatCount } from '../helpers/count-estimate';

formatCount(23450, true);   // "~23,450"
formatCount(1234, false);   // "1,234"
formatCount(1234567, true); // "~1.2M"
```

**Parameters:**
- `count`: Number to format
- `isEstimate`: Whether to add `~` prefix

**Returns:** `string` - Formatted count

## Model Integration

### killlist.ts

```typescript
// Fast estimation (use for pagination)
export async function estimateFilteredKills(
  filters: KilllistFilters
): Promise<number>

// Exact count (use for analytics)
export async function countFilteredKills(
  filters: KilllistFilters
): Promise<number>

// Entity-specific estimations
export async function estimateEntityKills(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance'
): Promise<number>

export async function estimateEntityKillmails(
  entityId: number,
  entityType: 'character' | 'corporation' | 'alliance',
  mode: 'kills' | 'losses' | 'all',
  filters?: KilllistFilters
): Promise<number>
```

## Usage in Routes

### Before (Slow):

```typescript
// ❌ Takes 5-30 seconds
const totalKillmails = await countFilteredKills(filters);
const totalPages = Math.ceil(totalKillmails / perPage);

// Shows: "Page 5 of 2,340"
```

### After (Fast):

```typescript
// ✅ Takes 5-50 milliseconds
const totalKillmails = await estimateFilteredKills(filters);
const totalPages = Math.ceil(totalKillmails / perPage);

// Shows: "Page 5 of ~2,340" or "Page 5 of 2.3k"
```

## When to Use Estimation

### ✅ Use Estimates For:
- Pagination display ("Page 5 of ~2,340")
- UI indicators ("~23k kills found")
- Quick filters and searches
- Real-time dashboards
- Any user-facing count display

### ❌ Use Exact Counts For:
- Analytics reports
- Billing/financial data
- Legal/compliance requirements
- When precision is contractually required
- Small result sets (<1000 rows)

## Accuracy Considerations

### Factors Affecting Accuracy:

1. **Statistics Freshness**
   - Run `ANALYZE` regularly (we do this after migrations)
   - Statistics targets set to 1000 for high-cardinality columns
   - Partitioned tables update statistics per-partition

2. **Filter Selectivity**
   - Simple filters (single equality): Very accurate (±5-10%)
   - Range filters on indexed columns: Good (±10-30%)
   - Complex multi-column filters: Moderate (±30-50%)
   - OR conditions: Less accurate (±50-100%)

3. **Index Usage**
   - BRIN indexes: Great for range estimates on sequential data
   - Partial indexes: Excellent for filtered estimates
   - B-tree indexes: Good for equality estimates

### Improving Accuracy:

```sql
-- Update statistics more frequently
ANALYZE killmails;

-- Increase statistics targets (already done in migration)
ALTER TABLE killmails ALTER COLUMN "killmailTime" SET STATISTICS 1000;

-- Check correlation for BRIN effectiveness
SELECT correlation FROM pg_stats 
WHERE tablename = 'killmails' AND attname = 'killmailTime';
-- Should be close to ±1.0 for best accuracy
```

## Performance Benchmarks

Based on testing with production-scale data:

| Method | Time | Accuracy | Use Case |
|--------|------|----------|----------|
| `COUNT(*)` | 5-30s | 100% | Analytics, reports |
| `estimateCount()` | 5-50ms | ±10-50% | Pagination, UI |
| `getTableEstimate()` | <1ms | ±5-10% | Total rows, no filters |
| `TABLESAMPLE(5%)` | 500ms-3s | ±10-30% | Not implemented |

**Speedup:** 100-1000x faster with acceptable accuracy trade-off

## UI Display Recommendations

### Option 1: Show Approximate Indicator

```
Showing page 5 of ~2,340
Found ~23.4k kills
```

### Option 2: Round to Significant Figures

```
Showing page 5 of 2.3k
Found ~23k kills
```

### Option 3: Hide Total (Infinite Scroll)

```
Showing 100 kills (load more...)
```

## Error Handling

The estimation functions handle errors gracefully:

```typescript
export async function estimateCount(
  queryFragment: ReturnType<typeof database.sql>
): Promise<number> {
  try {
    // ... EXPLAIN query
    return Math.round(estimate);
  } catch (error) {
    // Fail gracefully, return 0 instead of throwing
    console.error('Failed to estimate count via EXPLAIN:', error);
    return 0;
  }
}
```

If EXPLAIN fails:
- Returns 0 (allows page to render)
- Logs error for debugging
- Doesn't crash user request

## Future Optimizations

### 1. Redis Caching (Not Implemented Yet)

For common filters, cache estimates with short TTL:

```typescript
const cacheKey = `count:${hash(filters)}`;
const cached = await redis.get(cacheKey);
if (cached) return Number(cached);

const estimate = await estimateCount(query);
await redis.setex(cacheKey, 60, estimate); // 1 min TTL
return estimate;
```

**Why not now:** Page-level caching (Nitro) will handle this better.

### 2. Hybrid Approach

For very small estimates, do exact count:

```typescript
const estimate = await estimateCount(query);
if (estimate < 1000) {
  // Small result set, exact count is fast
  return await countExact(query);
}
return estimate;
```

Implemented as `estimateCountWithFallback()` in helper.

### 3. Materialized Statistics

Pre-compute common filter combinations:

```sql
CREATE MATERIALIZED VIEW killmail_filter_stats AS
SELECT 
  'big'::text as filter_type,
  COUNT(*) as count,
  NOW() as updated_at
FROM killmails WHERE ...
UNION ALL ...;

REFRESH MATERIALIZED VIEW CONCURRENTLY killmail_filter_stats;
```

## Testing

Run estimation tests:

```bash
bun test tests/count-estimate.test.ts
```

Tests verify:
- ✅ `estimateCount()` returns numbers
- ✅ `getTableEstimate()` works with patterns
- ✅ `formatCount()` formats correctly
- ✅ Error handling (empty results, invalid queries)

## Conclusion

Count estimation via EXPLAIN provides:
- **100-1000x speedup** over exact counts
- **Acceptable accuracy** (±10-50%) for pagination
- **Zero impact** on data or schema
- **Graceful degradation** on errors
- **Better UX** (instant page loads vs 30s waits)

For pagination and UI display, approximate counts are not just acceptable - they're preferred for performance.

---

**Last Updated:** 2025-11-25  
**Author:** Database Optimization Team  
**Related:** `server/helpers/count-estimate.ts`, `server/models/killlist.ts`
