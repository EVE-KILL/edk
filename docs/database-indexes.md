# Database Indexes

This document provides an overview of the database indexes used in this application, their purpose, and guidelines for maintenance and optimization.

## Killmails Table
- `"killmailId"`, `"killmailTime"` (PRIMARY KEY): Unique identifier for a killmail.
- `"idx_killmails_solar_system"` on `solarSystemId`: Used for filtering killmails by location.
- `"idx_killmails_victim_character"` on `victimCharacterId`: Used for querying a specific character's kill history.
- `"idx_killmails_victim_corporation"` on `victimCorporationId`: Used for querying a specific corporation's kill history.
- `"idx_killmails_victim_alliance"` on `victimAllianceId`: Used for querying a specific alliance's kill history.
- `"idx_killmails_victim_ship_type"` on `victimShipTypeId`: Used for filtering killmails by the victim's ship type.
- `"idx_killmails_victim_damage_taken"` on `victimDamageTaken`: Used for sorting killmails by damage taken.
- `"idx_killmails_total_value"` on `totalValue`: Used for sorting killmails by their total value.
- `"idx_killmails_time"` on `killmailTime`: Used for time-based queries.
- Composite: (`victimCharacterId`, `killmailTime`): For efficiently querying a character's kill history over a specific time range.

## Attackers Table
- `"id"`, `"killmailTime"` (PRIMARY KEY): Unique identifier for an attacker.
- `"idx_attackers_killmail_id"` on `killmailId`: Used for retrieving all attackers for a specific killmail.
- `"idx_attackers_character"` on `characterId`: Used for querying a specific character's involvement in kills.
- `"idx_attackers_corporation"` on `corporationId`: Used for querying a specific corporation's involvement in kills.
- `"idx_attackers_alliance"` on `allianceId`: Used for querying a specific alliance's involvement in kills.
- `"idx_attackers_ship_type"` on `shipTypeId`: Used for filtering attackers by ship type.
- `"idx_attackers_weapon_type"` on `weaponTypeId`: Used for filtering attackers by weapon type.
- `"idx_attackers_final_blow"` on `finalBlow`: Used for identifying the attacker who got the final blow.
- `"idx_attackers_time"` on `killmailTime`: Used for time-based queries.

## Items Table
- `"id"`, `"killmailTime"` (PRIMARY KEY): Unique identifier for an item.
- `"idx_items_killmail_id"` on `killmailId`: Used for retrieving all items for a specific killmail.
- `"idx_items_item_type"` on `itemTypeId`: Used for filtering items by their type.
- `"idx_items_flag"` on `flag`: Used for filtering items by their flag.
- `"idx_items_time"` on `killmailTime`: Used for time-based queries.

## Characters Table
- `"characterId"` (PRIMARY KEY): Unique identifier for a character.
- `"idx_characters_alliance"` on `allianceId`: Used for querying characters by alliance.
- `"idx_characters_corporation"` on `corporationId`: Used for querying characters by corporation.
- `"idx_characters_bloodline"` on `bloodlineId`: Used for querying characters by bloodline.
- `"idx_characters_race"` on `raceId`: Used for querying characters by race.

## Corporations Table
- `"corporationId"` (PRIMARY KEY): Unique identifier for a corporation.
- `"idx_corporations_alliance"` on `allianceId`: Used for querying corporations by alliance.
- `"idx_corporations_ceo"` on `ceoId`: Used for querying corporations by CEO.
- `"idx_corporations_creator"` on `creatorId`: Used for querying corporations by creator.

## Alliances Table
- `"allianceId"` (PRIMARY KEY): Unique identifier for an alliance.
- `"idx_alliances_creator_corp"` on `creatorCorporationId`: Used for querying alliances by creator corporation.
- `"idx_alliances_creator"` on `creatorId`: Used for querying alliances by creator.
- `"idx_alliances_executor_corp"` on `executorCorporationId`: Used for querying alliances by executor corporation.

## Composite Indexes

A composite index is an index on multiple columns. It can be more efficient than multiple single-column indexes, especially for queries that filter on multiple columns. The order of the columns in a composite index is important.

For example, an index on `(victimCharacterId, killmailTime)` is useful for queries that filter by `victimCharacterId` and then sort by `killmailTime`.

## Index Monitoring

### Finding Unused Indexes
The following query can be used to identify indexes that are not being used. A low `idx_scan` value indicates that the index is rarely or never used.

```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 10;
```

## Query Analysis

### EXPLAIN ANALYZE
To analyze the performance of a query and determine if it's using an index, you can use the `EXPLAIN ANALYZE` command.

```sql
EXPLAIN ANALYZE SELECT * FROM killmails WHERE "solarSystemId" = 30000142;
```

The output of this command will show the query plan and the actual execution time. Look for "Index Scan" to confirm that an index is being used. If you see a "Seq Scan" (Sequential Scan), it means the database is scanning the entire table, which can be slow on large tables.

## Index Creation

### Migration Template
When adding a new index, use the following template in your migration file.

```sql
-- Migration: Add index for <purpose>
-- Improves query: <query pattern>
-- Expected performance: <metrics>
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

Using `CREATE INDEX CONCURRENTLY` is recommended to avoid locking the table during index creation.

## Index Maintenance

### REINDEX
Over time, indexes can become fragmented, which can reduce their effectiveness. You can rebuild an index using the `REINDEX` command.

```sql
REINDEX INDEX index_name;
```

### Index Bloat
Index bloat occurs when an index contains a significant amount of empty or unused space. You can monitor index bloat using various tools and queries.

### Autovacuum Configuration
PostgreSQL's autovacuum daemon helps to maintain the health of indexes by automatically cleaning up dead tuples. Ensure that autovacuum is properly configured for your workload.
