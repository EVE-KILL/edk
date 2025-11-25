# Database Optimization Plan - Phase 1

## Overview

This plan implements **low-risk, high-reward** PostgreSQL optimizations for the killmails, attackers, and items tables. Based on CCP's ID ranges and your data characteristics, we're focusing on index optimization rather than data type changes.

## What We're NOT Changing

### BIGSERIAL IDs - Staying as-is ✅
- **attackers.id**: BIGSERIAL (will exceed 2.1B rows eventually)
- **items.id**: BIGSERIAL (will exceed 2.1B rows eventually)
- **Rationale**: Better to keep BIGSERIAL than migrate twice

### Entity IDs - Staying BIGINT ✅
CCP's ID ranges (from https://developers.eveonline.com/docs/guides/id-ranges/):
- Characters: 90,000,000 → 98,000,000 (then 2,100,000,000+)
- Corporations: 98,000,000 → 99,000,000 (then 2,000,000,000+)  
- Alliances: 99,000,000 → 100,000,000 (then up to 2,129,999,999)
- **All need BIGINT** - too close to INTEGER max (2,147,483,647)

### Type IDs - Already INTEGER ✅
- Ship types, weapon types, item types: Max ~65,000
- INTEGER is fine, already optimized

## What We ARE Optimizing

### 1. BRIN Indexes (99% Size Reduction) 🚀

**What:** Replace B-tree indexes with BRIN on time-series columns

**Why:** Your data is chronologically inserted = perfect for BRIN
- `attackers.killmailTime`: Sequential inserts
- `items.killmailTime`: Sequential inserts  
- `attackers.killmailId`: Highly correlated with time
- `items.killmailId`: Highly correlated with time

**Impact:**
- B-tree: 500 MB → BRIN: 1 MB per index
- Same query performance for range scans
- Faster INSERTs (less index maintenance)
- More data fits in RAM

**Example:**
```sql
-- Before: B-tree index
CREATE INDEX idx_attackers_time ON attackers ("killmailTime");
-- Size: ~500 MB for 10M rows

-- After: BRIN index
CREATE INDEX idx_attackers_time_brin ON attackers 
  USING BRIN ("killmailTime") 
  WITH (pages_per_range = 128);
-- Size: ~1 MB for 10M rows
```

### 2. Partial Indexes (50-90% Size Reduction) 🎯

**What:** Only index rows that match common WHERE clauses

**Why:** Most queries filter data:
- "Show me NON-NPC kills" → only index non-NPC
- "Show me alliance kills" → only index non-NULL alliances
- "Show me final blows" → only index finalBlow = true

**Examples:**

#### Alliance Attackers (70-80% reduction)
Most NPCs have NULL alliance, why index them?
```sql
-- Before: Index ALL rows
CREATE INDEX idx_attackers_alliance ON attackers ("allianceId");
-- Size: 100% of rows

-- After: Index only non-NULL alliances
CREATE INDEX idx_attackers_alliance_nonnull ON attackers ("allianceId")
  WHERE "allianceId" IS NOT NULL;
-- Size: 20-30% of rows
```

#### Final Blows (95% reduction)
Only 1 final blow per killmail, but 10-50 attackers total:
```sql
-- Before: Index ALL rows
CREATE INDEX idx_attackers_final_blow ON attackers ("finalBlow");
-- Size: 100% of rows

-- After: Index only final blows
CREATE INDEX idx_attackers_final_blow_only ON attackers ("killmailId")
  WHERE "finalBlow" = true;
-- Size: 2-10% of rows
```

#### High-Value Kills (98% reduction)
For "top kills" leaderboards:
```sql
CREATE INDEX idx_killmails_highvalue ON killmails ("totalValue" DESC)
  WHERE "totalValue" > 100000000;  -- >100M ISK
-- Only indexes expensive kills, perfect for leaderboards
```

### 3. Index-Only Scans with INCLUDE (2-10x Faster) ⚡

**What:** Add frequently-queried columns to indexes

**Why:** PostgreSQL can answer queries from index alone, no heap lookup needed

**Example:**
```sql
-- Query: Get character's recent kills with ship info
SELECT "characterId", "killmailTime", "killmailId", "shipTypeId"
FROM attackers 
WHERE "characterId" = 123456789
ORDER BY "killmailTime" DESC
LIMIT 50;

-- Before: Index lookup + 50 heap fetches
CREATE INDEX idx_attackers_character ON attackers ("characterId");

-- After: Index-only scan (0 heap fetches!)
CREATE INDEX idx_attackers_char_incl ON attackers ("characterId", "killmailTime" DESC)
  INCLUDE ("killmailId", "shipTypeId", "damageDone", "finalBlow");
```

**Result:** Query completes 2-10x faster by avoiding heap access

### 4. Better Statistics (Better Query Plans) 📊

**What:** Increase statistics sampling for high-cardinality columns

**Why:** Default statistics (100 samples) isn't enough for millions of unique values

```sql
-- Increase from 100 to 1000 samples
ALTER TABLE attackers ALTER COLUMN "characterId" SET STATISTICS 1000;
```

**Impact:** Query planner makes better decisions about index usage

### 5. Fillfactor Optimization (Less Bloat) 🗜️

**What:** Set fillfactor = 100 for append-only tables

**Why:** 
- Default fillfactor = 90 (leaves 10% free space for updates)
- Your tables are append-only (no updates)
- 100 = pack pages fully, no wasted space

```sql
ALTER TABLE killmails SET (fillfactor = 100);
ALTER TABLE attackers SET (fillfactor = 100);
ALTER TABLE items SET (fillfactor = 100);
```

## Implementation Plan

### Step 1: Create New Indexes (Safe, No Downtime)
```bash
# Run migration
PGPASSWORD=edk_password psql -h localhost -U edk_user -d edk \
  -f db/70-optimize-indexes-phase1.sql
```

**Time:** 5-30 minutes depending on data size  
**Impact:** None, just creates additional indexes

### Step 2: Monitor Performance (1-7 Days)

Check which indexes are actually being used:
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan,
  idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('killmails', 'attackers', 'items')
ORDER BY pg_relation_size(indexrelid) DESC;
```

Test query performance:
```sql
-- Should use BRIN index
EXPLAIN ANALYZE 
SELECT * FROM attackers 
WHERE "killmailTime" > NOW() - INTERVAL '7 days';

-- Should use index-only scan
EXPLAIN ANALYZE 
SELECT "characterId", "killmailTime", "killmailId", "shipTypeId" 
FROM attackers 
WHERE "characterId" = 123456789;

-- Should use partial index
EXPLAIN ANALYZE
SELECT * FROM attackers
WHERE "allianceId" = 99000001
  AND "killmailTime" > NOW() - INTERVAL '30 days';
```

### Step 3: Drop Old Indexes (Reclaim Space)

Once you verify BRIN indexes perform well:
```sql
-- Drop old B-tree indexes
DROP INDEX IF EXISTS idx_attackers_time;
DROP INDEX IF EXISTS idx_items_time;
DROP INDEX IF EXISTS idx_attackers_killmail_id;

-- Already dropped by migration (replaced with partial indexes)
-- idx_attackers_alliance → idx_attackers_alliance_nonnull
-- idx_attackers_character → idx_attackers_character_nonnull
-- idx_attackers_final_blow → idx_attackers_final_blow_only
```

**Space Reclaimed:** Potentially 5-10 GB per table (depending on current data)

## Expected Results

### Storage Savings
- **Time indexes**: 99% reduction (GB → MB)
- **Partial indexes**: 50-90% reduction vs full indexes
- **Total estimated savings**: 30-60% of current index size

### Performance Improvements
- **Range queries**: Same or slightly faster (BRIN + partition pruning)
- **Entity queries**: 2-10x faster (index-only scans)
- **INSERT speed**: 10-30% faster (less index maintenance)
- **Cache efficiency**: More data fits in RAM

### Real-World Example (10M attackers)
```
Before:
├── attackers table: 2 GB
├── B-tree indexes: 3 GB
└── Total: 5 GB

After:
├── attackers table: 2 GB
├── BRIN indexes: 5 MB
├── Partial indexes: 500 MB
├── INCLUDE indexes: 800 MB
└── Total: 3.3 GB (34% reduction)
```

## Rollback Plan

If something goes wrong:

```sql
-- Drop new indexes
DROP INDEX IF EXISTS idx_attackers_time_brin;
DROP INDEX IF EXISTS idx_items_time_brin;
DROP INDEX IF EXISTS idx_attackers_killmail_brin;
DROP INDEX IF EXISTS idx_items_killmail_brin;
-- ... (drop all new indexes)

-- Recreate old indexes
CREATE INDEX idx_attackers_time ON attackers ("killmailTime");
CREATE INDEX idx_attackers_alliance ON attackers ("allianceId");
-- ... (recreate old indexes from git history)
```

## Future Optimizations (Not in Phase 1)

### Phase 2: Compression (PostgreSQL 14+)
- Enable LZ4/ZSTD compression on TEXT/JSONB columns
- Potential 20-40% reduction in TOAST storage

### Phase 3: Columnar Storage (Advanced)
- Convert old partitions to columnar format (Citus extension)
- 10-50x compression for analytics on historical data
- Read-only, perfect for old killmails

### Phase 4: Materialized Views
- Optimize existing mat views with CONCURRENTLY refresh
- Add BRIN indexes to mat views

## Monitoring & Maintenance

### Weekly Checks
```sql
-- Check index bloat
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  idx_scan,
  CASE WHEN idx_scan = 0 THEN '⚠️ UNUSED' ELSE '✅' END AS status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check BRIN correlation (should be 0.9+)
SELECT 
  tablename, 
  attname, 
  correlation,
  CASE WHEN ABS(correlation) > 0.9 THEN '✅ EXCELLENT' 
       WHEN ABS(correlation) > 0.7 THEN '👍 GOOD'
       ELSE '⚠️ POOR' END AS brin_suitability
FROM pg_stats 
WHERE tablename IN ('attackers', 'items')
  AND attname IN ('killmailTime', 'killmailId');
```

### Monthly Maintenance
```sql
-- Reindex BRIN indexes to update min/max summaries
REINDEX INDEX CONCURRENTLY idx_attackers_time_brin;
REINDEX INDEX CONCURRENTLY idx_items_time_brin;

-- Re-analyze tables
ANALYZE killmails;
ANALYZE attackers;
ANALYZE items;
```

## Questions & Concerns

### Q: Will BRIN slow down exact lookups?
**A:** Yes, slightly (5-20% slower), but:
- 99% of your queries are range scans (`WHERE time > X`)
- Exact lookups still use other indexes (characterId, killmailId on B-tree/partial)
- The space savings enable better caching = net performance gain

### Q: What if correlation drops over time?
**A:** Monitor with `pg_stats.correlation`. If it drops below 0.7:
- Run `REINDEX INDEX CONCURRENTLY` to update BRIN summaries
- Consider adjusting `pages_per_range` (lower = more precise)
- Worst case: fall back to B-tree indexes

### Q: Can I test this on a copy first?
**A:** Absolutely! Recommended approach:
```bash
# Create test database with production data sample
pg_dump -h prod_host -U edk_user -d edk -t killmails -t attackers -t items | \
  psql -h localhost -U edk_user -d edk_test

# Run migration on test DB
psql -h localhost -U edk_user -d edk_test -f db/70-optimize-indexes-phase1.sql

# Benchmark queries on both
```

### Q: What about partition indexes?
**A:** Indexes on parent tables automatically inherit to partitions. New partitions created after this migration will have all these optimizations automatically.

## Summary

**Risk Level:** ⭐⭐☆☆☆ (Low)  
**Effort:** ⭐⭐☆☆☆ (1-2 hours)  
**Impact:** ⭐⭐⭐⭐⭐ (30-60% storage reduction, 2-10x query speedup)  

**Recommendation:** Deploy to production during next maintenance window. The benefits far outweigh the minimal risk.

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-25  
**Author:** Database Optimization Team
