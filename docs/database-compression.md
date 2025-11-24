# PostgreSQL Compression Optimization

## Current Configuration

**PostgreSQL Version:** 16.11  
**Default Compression:** LZ4 (enabled at database level)  
**Compression Method:** LZ4 (faster than PGLZ, similar compression ratio)

## What Gets Compressed

### Compressible Data Types
- **VARCHAR/TEXT** - Names, descriptions, tickers (primary benefit)
- **JSONB** - JSON data structures
- **BYTEA** - Binary data
- Arrays of the above types

### NOT Compressible (Fixed-Size Types)
- **INTEGER, BIGINT, SMALLINT** - Already optimal
- **BOOLEAN** - 1 byte, cannot compress
- **TIMESTAMP** - 8 bytes, cannot compress
- **FLOAT/DOUBLE PRECISION** - Already compact binary

## Current Table Compression Status

### Large Tables with NO Compression Benefit
- ✗ **items** (349 MB) - ALL columns are numeric/boolean (BIGINT, SMALLINT, BOOLEAN)
- ✗ **attackers** (169 MB) - ALL columns are numeric/boolean (BIGINT, INTEGER, BOOLEAN, REAL)
- ⚠️ **killmails** (113 MB) - Only `hash` field (VARCHAR 40) is compressible (~0.1% of data)

### Tables with Compression Benefit
- ✓ **characters** - `name` field (TEXT)
- ✓ **corporations** - `name`, `ticker` fields (TEXT)
- ✓ **alliances** - `name`, `ticker` fields (TEXT)
- ✓ **SDE tables** - Many TEXT fields for names/descriptions

## Space Savings Reality Check

### Items Table (349 MB - largest)
```
Columns: id, killmailId, killmailTime, flag, itemTypeId, 
         quantityDropped, quantityDestroyed, singleton, createdAt
```
**All fixed-size numeric/boolean** → **0% savings from compression**

### Attackers Table (169 MB)
```
Columns: id, killmailId, killmailTime, allianceId, corporationId, 
         characterId, damageDone, finalBlow, securityStatus, 
         shipTypeId, weaponTypeId, createdAt
```
**All fixed-size numeric/boolean** → **0% savings from compression**

### Killmails Table (113 MB)
```
Compressible: hash VARCHAR(40) - maybe 5MB of data
Non-compressible: All other columns (numeric IDs, positions, flags)
```
**Potential savings: ~1-2 MB** (hash field compression)

### Entity Tables (moderate benefit)
- Characters: ~10-30% compression on name field
- Corporations: ~10-30% compression on name/ticker
- Alliances: ~10-30% compression on name/ticker

### SDE Tables (good benefit)
- Types, groups, regions, etc.: ~20-40% compression on descriptions

## Actual Impact Estimate

**Your killmail-heavy tables:** ~1-2% total space savings  
**Entity + SDE tables:** ~15-25% space savings on those tables

### Why So Little?
The bulk of your data (items, attackers) is **pure numeric data** which:
1. Is already in optimal binary format
2. Has high entropy (random IDs, quantities)
3. Cannot be compressed meaningfully

## Recommendations for Space Savings

### 1. **Partition Archival** (Best ROI)
```sql
-- Detach old partitions, archive to S3/cold storage
ALTER TABLE items DETACH PARTITION items_2007;
-- Keep only last N years online
```
**Savings: 50-90%** depending on retention policy

### 2. **Index Optimization** (Good ROI)
Currently indexes take ~40-50% of total space:
- Review which indexes are actually used
- Drop unused indexes
- Consider partial indexes for common queries
```sql
-- Example: Index only recent data
CREATE INDEX idx_items_recent ON items (killmailId) 
WHERE killmailTime > NOW() - INTERVAL '1 year';
```
**Potential savings: 10-20%** if unused indexes exist

### 3. **Column Store Extension - cstore_fdw** (High effort, high reward)
For historical/analytical queries, columnar storage can achieve:
- 10-20x compression on numeric data
- Excellent for time-series analysis
- Read-only partitions only
**Potential savings: 80-90%** on archived partitions

### 4. **TimescaleDB** (Major rewrite)
Purpose-built for time-series data:
- Automatic compression (10-20x)
- Chunk-based partitioning
- Query optimization for time-series
**Potential savings: 70-90%** overall

### 5. **Regular Maintenance** (Free)
```bash
# Analyze tables for query planning
ANALYZE;

# Reclaim dead space (non-blocking)
VACUUM;

# Full rewrite (blocking, maintenance window only)
VACUUM FULL;
```

### 6. **FILLFACTOR Tuning** (Marginal)
For frequently updated tables, leave room for HOT updates:
```sql
ALTER TABLE characters SET (fillfactor = 90);
-- Reduces bloat from updates, but you're mostly INSERT-heavy
```

## Current Compression Enabled

✅ LZ4 compression enabled on:
- All VARCHAR/TEXT columns in entity tables
- All description fields in SDE tables
- Killmails.hash field

🔄 New data automatically uses LZ4  
⏳ Existing data recompresses on UPDATE or VACUUM FULL

## Monitor Compression Effectiveness

```sql
-- Check actual compression ratios
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                 pg_relation_size(schemaname||'.'||tablename)) AS overhead
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Bottom Line

**For your use case (killmail tracking):**
- Compression helps ~5-10% on entity/SDE tables
- Main tables (items/attackers) cannot compress meaningfully
- **Best strategy:** Partition management + index optimization + archival

**Most effective for space savings:**
1. 🥇 Partition archival (detach old data)
2. 🥈 Index cleanup (remove unused indexes)
3. 🥉 Columnar storage for archives (cstore_fdw or TimescaleDB)
4. Column compression (already done, marginal benefit)
