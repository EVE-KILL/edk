# Database Migrations

This directory contains the modular ClickHouse database schema files for EVE-KILL EDK.

## Migration System

Migrations are applied automatically by `server/plugins/schema-migration.ts` when the Nitro server starts. The plugin:

1. Reads all `.sql` files from this directory
2. Sorts them alphabetically by filename
3. Concatenates them into a single schema
4. Calculates a checksum and compares with stored checksum
5. If changed, executes all SQL statements sequentially
6. Saves new checksum to `.data/schema-checksum.txt`

## File Naming Convention

Files are prefixed with numbers to control execution order:

- **01-09**: Infrastructure (database, migrations table, config)
- **10-19**: Core application tables (killmails, entities, prices)
- **20-29**: SDE (Static Data Export) tables
- **30-39**: Additional reference tables
- **40-49**: Existing materialized views
- **50-59**: NEW optimized materialized views
- **60-69**: Projections and indexes

## Files

### Infrastructure (01-09)

- `01-create-database.sql` - Creates the `edk` database
- `02-create-migrations-table.sql` - Migration tracking table
- `03-create-config-table.sql` - Configuration key-value store

### Core Tables (10-19)

- `10-create-killmail-tables.sql` - killmails, attackers, items
  - **Optimization #5**: killmailTime field added to attackers/items for aligned partitioning
- `11-create-entity-tables.sql` - characters, corporations, alliances
  - **Optimization #1**: Removed duplicate table definitions
- `12-create-prices-table.sql` - Item price tracking

### SDE Tables (20-29)

- `20-create-sde-map-tables.sql` - Solar systems, regions, constellations, stargates, stars, planets, moons, asteroid belts
- `21-create-sde-type-tables.sql` - Types, groups, categories, market groups, meta groups
- `22-create-sde-npc-tables.sql` - NPC corporations, stations, characters
- `23-create-sde-character-tables.sql` - Factions, races, bloodlines, ancestries
- `24-create-sde-dogma-tables.sql` - Dogma attributes and effects
- `25-create-sde-cosmetic-tables.sql` - Skins, station operations

### Existing Views (40-49)

- `40-create-killlist-views.sql` - killlist_frontpage, entity_killlist
  - **Optimization #6**: Added set(100) indexes on entity IDs
- `41-create-topbox-views.sql` - top_box_frontpage
  - **Optimization #6**: Added set(100) indexes on entity IDs
- `42-create-valuable-kills-views.sql` - most_valuable_kills_frontpage
  - **Optimization #6**: Added set(100) indexes on entity IDs

### New Optimized Views (50-59)

- `50-create-esi-materialized-view.sql` - **Optimization #2**: Pre-computed ESI format
  - Benefits: 10-50x faster killmail API lookups
  - Tradeoff: ~5-7 KB additional storage per killmail
- `51-create-entity-stats-view.sql` - **Optimization #3**: Unified entity statistics
  - Benefits: 2-5x faster entity page loads
  - Tradeoff: ~1 KB per entity per time period
- `52-create-killreports-view.sql` - **Optimization #9**: Pre-computed kill reports
  - Benefits: Instant report generation, no runtime aggregation
  - Tradeoff: ~500 bytes per entity per day
- `53-create-activity-aggregation-view.sql` - **Optimization #11**: Daily activity tracking
  - Benefits: Fast activity timeline queries
  - Tradeoff: ~200 bytes per entity per day

### Projections & Indexes (60-69)

- `60-create-value-projections.sql` - **Optimization #4**: Value-sorted projections
  - Benefits: 5-10x faster "most valuable kills" queries
  - Tradeoff: ~15% additional storage (~650 bytes per killmail)

## Schema Optimizations Applied

The schema files implement 9 approved optimizations from `SCHEMA_OPTIMIZATION_ANALYSIS.md`:

1. ✅ **Remove Duplicate Tables** - Cleaned up entity table definitions
2. ✅ **Materialized ESI View** - Pre-compute ESI format for instant API responses
3. ✅ **Unified Entity Stats** - Single table for all entity statistics
4. ✅ **Value Projections** - Sorted projections for expensive kill queries
5. ✅ **Fixed Partitioning** - Aligned partitions using killmailTime
6. ✅ **Set Indexes** - Fast IN queries for entity filtering
7. ✅ **Kill Reports** - Pre-computed daily reports with breakdowns
8. ✅ **Activity Aggregations** - Daily activity pattern tracking

**Rejected optimizations** (#7, #8, #10, #12, #13) were not implemented per user decision.

## Storage Impact

Based on 1 million killmails/month with 10 attackers and 5 items each:

- **Before**: ~4.3 KB per killmail
- **After**: ~11.5 KB per killmail
- **Increase**: ~$3.08/month for ClickHouse storage

Trade-off: ~3x storage increase for 10-100x query performance improvements.

## Performance Benefits

- **Killmail API**: 10-50x faster (ESI view)
- **Entity Pages**: 2-5x faster (unified stats)
- **Value Queries**: 5-10x faster (projections)
- **Entity Filters**: 5-10x faster (set indexes)
- **Kill Reports**: Instant (pre-computed)
- **Timelines**: 10-20x faster (activity aggregations)

## Development

### Adding New Tables

1. Create a new `.sql` file with appropriate numeric prefix
2. Follow naming convention: `XX-create-feature-tables.sql`
3. Include comments explaining purpose and optimizations
4. Use appropriate ClickHouse engine (ReplacingMergeTree, MergeTree, SummingMergeTree)
5. Add indexes as needed
6. Restart dev server to apply: `bun run dev`

### Adding New Views

1. Create file in 40-49 range for existing views, 50-59 for new optimized views
2. Create both the destination table AND the materialized view
3. Document benefits and tradeoffs
4. Include optimization number if from analysis document

### Adding Indexes/Projections

1. Create file in 60-69 range
2. Use ALTER TABLE statements
3. Note that OPTIMIZE TABLE must be run to materialize for existing data

## Testing

Test the migration system:

```bash
# Start dev server (applies migrations automatically)
bun run dev

# Check migration logs for errors
# Verify tables were created

# Test specific migration by deleting checksum
rm .data/schema-checksum.txt
bun run dev
```

Verify table creation in ClickHouse:

```bash
# Connect to ClickHouse
docker exec -it edk-clickhouse clickhouse-client --user edk_user --password edk_password --database edk

# List all tables
SHOW TABLES;

# Check table structure
DESCRIBE killmails;

# Verify materialized views
SELECT name FROM system.tables WHERE database = 'edk' AND engine LIKE '%Materialized%';
```

## Troubleshooting

**Migration not running**: Delete `.data/schema-checksum.txt` to force re-migration

**Table already exists errors**: These are non-critical, migration will continue

**Syntax errors**: Check SQL syntax in the specific file, fix and restart

**Performance issues**: Run `OPTIMIZE TABLE` on large tables after migration

## Notes

- Migrations are **destructive** - they create tables with `IF NOT EXISTS` but won't modify existing tables
- To update existing tables, create ALTER TABLE statements in new migration files
- Materialized views only process NEW data - backfill existing data separately
- Projections must be materialized with `OPTIMIZE TABLE ... FINAL` for existing data
- Schema checksum is stored in `.data/schema-checksum.txt`
