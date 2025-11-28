# Database System

EVE-KILL uses PostgreSQL 14+ as its primary database with advanced features including partitioning, trigram search, and automated schema migrations.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Web Server  │  │ Queue Workers│  │  Cron Jobs       │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────┘   │
└─────────┼──────────────────┼────────────────────┼───────────┘
          │                  │                    │
          └──────────────────┼────────────────────┘
                             ▼
                    ┌────────────────────┐
                    │  DatabaseHelper    │
                    │  (server/helpers/  │
                    │   database.ts)     │
                    └─────────┬──────────┘
                              ▼
                    ┌────────────────────┐
                    │   postgres.js      │
                    │   (Driver)         │
                    └─────────┬──────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL 14+                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Partitioned Tables                                  │   │
│  │  - killmails (by month)                              │   │
│  │  - killmails_2024_01, killmails_2024_02, ...        │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Entity Tables                                       │   │
│  │  - characters, corporations, alliances               │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  SDE Tables                                          │   │
│  │  - types, groups, solarsystems, regions, ...        │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Indexes                                             │   │
│  │  - B-tree (ID lookups)                               │   │
│  │  - GIN trigram (search)                              │   │
│  │  - Composite (filtered queries)                      │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Views                                               │   │
│  │  - kill_list (dynamic query view)                   │   │
│  │  - celestials (SDE aggregation)                      │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Materialized Views                                  │   │
│  │  - top_characters_weekly                             │   │
│  │  - top_corporations_weekly                           │   │
│  │  - top_alliances_weekly                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Database Helper

### Overview

The `DatabaseHelper` class (`server/helpers/database.ts`) provides a convenient abstraction over `postgres.js`:

```typescript
import { database } from '@/helpers/database';

// Access raw postgres.js client
const sql = database.sql;

// Helper methods
await database.query<T>('SELECT ...', { params });
await database.queryOne<T>('SELECT ...', { params });
await database.queryValue<T>('SELECT ...', { params });
await database.execute('INSERT ...', { params });
await database.insert('table', data);
await database.bulkInsert('table', [data]);
await database.count('table', 'WHERE ...', { params });
await database.ping(); // Health check
```

### Important: Column Name Quoting

**Mixed-case columns MUST be quoted in raw SQL**:

```typescript
// ✅ CORRECT - double quotes around mixed-case columns
await sql`SELECT "killmailId", "killmailTime" FROM killmails`;

// ❌ WRONG - will look for lowercase columns
await sql`SELECT killmailId, killmailTime FROM killmails`;
```

**When using helper methods, keys are automatically handled**:

```typescript
// ✅ CORRECT - helper handles quoting
await database.insert('killmails', {
  killmailId: 123,
  killmailTime: new Date(),
});
```

## Schema Migrations

### Migration Files

Migrations are SQL files in `db/` directory:

```
db/
├── 01-create-migrations-table.sql
├── 05-create-config-table.sql
├── 10-create-killmail-tables.sql
├── 11-create-entity-tables.sql
├── 12-create-prices-table.sql
├── 20-create-sde-map-tables.sql
├── 21-create-sde-type-tables.sql
...
```

**Naming Convention**: `##-description.sql`

- Numbers determine execution order
- Descriptive name for clarity

### Migration Execution

Migrations run automatically on server startup via `server/plugins/schema-migration.ts`:

1. Checks `migrations` table for applied migrations
2. Runs new migrations in order
3. Stores checksum to detect changes
4. **Automatically adds missing columns** if schema is modified

**Manual Migration**:

```bash
bun cli db:migrate
```

### Migration Table

```sql
CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) UNIQUE NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW()
);
```

### Auto-Column Addition

The schema migration plugin can automatically add missing columns:

1. Parses `CREATE TABLE` statements from migration files
2. Compares with existing table schema
3. Adds any missing columns with appropriate `ALTER TABLE` commands

This allows adding new columns to existing tables without writing separate migration files.

## Table Partitioning

### Killmails Table

The `killmails` table is partitioned by month for performance:

```sql
CREATE TABLE killmails (
  "killmailId" BIGINT NOT NULL,
  "killmailTime" TIMESTAMP NOT NULL,
  ...
) PARTITION BY RANGE ("killmailTime");

-- Partitions created automatically
CREATE TABLE killmails_2024_01 PARTITION OF killmails
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE killmails_2024_02 PARTITION OF killmails
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### Benefits

- **Faster queries**: Only scan relevant partitions
- **Easier maintenance**: Drop old partitions instead of DELETE
- **Better vacuum performance**: Smaller tables to maintain
- **Parallel processing**: Query multiple partitions simultaneously

### Partition Management

**Automatic Creation** via cron job:

```bash
bun cli db:partitions
```

This runs monthly and creates partitions for the next 3 months.

**Manual Creation**:

```typescript
await database.execute(`
  CREATE TABLE IF NOT EXISTS killmails_2024_12
  PARTITION OF killmails
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01')
`);
```

### Querying Partitioned Tables

Queries automatically use partition pruning when filtering by time:

```sql
-- Only scans killmails_2024_01
SELECT * FROM killmails
WHERE "killmailTime" >= '2024-01-01'
  AND "killmailTime" < '2024-02-01';
```

**Best Practice**: Always include `killmailTime` range in queries.

## Indexes

### Index Types

**B-tree** (default):

```sql
CREATE INDEX idx_killmails_system ON killmails("solarSystemId");
CREATE INDEX idx_characters_corporation ON characters("corporationId");
```

Use for: Equality checks, range queries, sorting

**GIN Trigram** (for search):

```sql
CREATE INDEX idx_characters_name_trgm
  ON characters USING gin(name gin_trgm_ops);
```

Use for: Full-text search, similarity matching

**Composite** (multiple columns):

```sql
CREATE INDEX idx_killmails_victim
  ON killmails("victimCharacterId", "killmailTime" DESC);
```

Use for: Queries filtering on multiple columns

### Index Maintenance

**Reindex**:

```bash
# Rebuild specific index
REINDEX INDEX idx_characters_name_trgm;

# Rebuild all indexes on table
REINDEX TABLE characters;
```

**Analyze** (update statistics):

```bash
ANALYZE characters;
ANALYZE killmails;
```

Automated via cron job:

```bash
bun cli db:analyze
```

## Views and Materialized Views

### Regular Views

**kill_list** (`db/45-create-entity-stats-views.sql`):

- Dynamic query results (no storage)
- Always up-to-date
- Used for killmail listing pages

**celestials** (`db/30-create-celestials-view.sql`):

- Aggregates SDE map data
- Joins solar systems, stations, stargates, etc.

### Materialized Views

**Top Stats** (`db/40-create-mat-views.sql`):

- `top_characters_weekly`
- `top_corporations_weekly`
- `top_alliances_weekly`

**Benefits**:

- Pre-computed aggregations
- Fast access to statistics
- Refreshed periodically (not real-time)

**Refresh**:

```bash
# Refresh all materialized views
bun cli db:refresh

# Refresh specific view
REFRESH MATERIALIZED VIEW top_characters_weekly;
```

Automated via cron job (daily):

```bash
bun cronjobs refresh-materialized-views
```

## Database Models

Models are in `server/models/` and provide type-safe database access:

### Model Pattern

```typescript
// server/models/characters.ts

export interface Character {
  id: number;
  name: string;
  corporationId: number;
  allianceId?: number;
  lastUpdated: Date;
}

export async function getCharacter(id: number): Promise<Character | null> {
  return database.queryOne<Character>(
    `SELECT * FROM characters WHERE id = :id`,
    { id }
  );
}

export async function storeCharacter(character: Character): Promise<void> {
  await database.execute(
    `INSERT INTO characters (id, name, "corporationId", "allianceId", "lastUpdated")
     VALUES (:id, :name, :corporationId, :allianceId, :lastUpdated)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       "corporationId" = EXCLUDED."corporationId",
       "allianceId" = EXCLUDED."allianceId",
       "lastUpdated" = EXCLUDED."lastUpdated"`,
    character
  );
}
```

### Using Models

```typescript
import { getCharacter, storeCharacter } from '@/models/characters';

// Fetch character
const character = await getCharacter(90000001);

// Store character
await storeCharacter({
  id: 90000001,
  name: 'Test Character',
  corporationId: 98000001,
  lastUpdated: new Date(),
});
```

## Performance Best Practices

### Query Optimization

1. **Use indexes** - Add indexes for frequently filtered columns
2. **Limit results** - Always use `LIMIT` when possible
3. **Project only needed columns** - Avoid `SELECT *` in production
4. **Use prepared statements** - Let `postgres.js` cache query plans
5. **Batch operations** - Use `bulkInsert()` instead of multiple single inserts

### Bulk Inserts

```typescript
// ✅ GOOD - single transaction
await database.bulkInsert('attackers', attackers);

// ❌ BAD - multiple transactions
for (const attacker of attackers) {
  await database.insert('attackers', attacker);
}
```

### Bulk Upserts

```typescript
// Insert or update on conflict
await database.bulkUpsert('characters', characters, ['id']);
```

### Connection Pooling

`postgres.js` handles connection pooling automatically:

```typescript
const sql = postgres(process.env.DATABASE_URL, {
  max: 10, // Max connections
  idle_timeout: 20,
  connect_timeout: 30,
});
```

## Monitoring and Health

### Health Checks

```typescript
// Simple ping
const isHealthy = await database.ping();

// Connection count
const connections = await sql`
  SELECT count(*) FROM pg_stat_activity
  WHERE datname = current_database()
`;
```

### Query Performance

**Explain query**:

```sql
EXPLAIN ANALYZE
SELECT * FROM killmails
WHERE "solarSystemId" = 30000142
  AND "killmailTime" > NOW() - INTERVAL '7 days'
LIMIT 100;
```

**Slow query log**: Configure in `postgresql.conf`:

```
log_min_duration_statement = 1000  # Log queries > 1 second
```

### Database Size

```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('edk'));

-- Table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Index Usage

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Backup and Recovery

### Backup

```bash
# Full backup
pg_dump -h localhost -U edk_user -d edk -F c -f edk_backup.dump

# Schema only
pg_dump -h localhost -U edk_user -d edk --schema-only > schema.sql

# Data only
pg_dump -h localhost -U edk_user -d edk --data-only > data.sql
```

### Restore

```bash
# Restore from dump
pg_restore -h localhost -U edk_user -d edk edk_backup.dump

# Restore from SQL
psql -h localhost -U edk_user -d edk < schema.sql
```

### Automated Backups

Configure via cron job (recommended daily):

```bash
0 2 * * * pg_dump -h localhost -U edk_user -d edk -F c -f /backups/edk_$(date +\%Y\%m\%d).dump
```

## CLI Commands

```bash
# Run migrations
bun cli db:migrate

# Create partitions
bun cli db:partitions

# Refresh materialized views
bun cli db:refresh

# Analyze tables (update statistics)
bun cli db:analyze

# Test database connection
bun cli db:test

# Database health check
bun cli db:health
```

## Troubleshooting

### Connection Issues

1. Check Docker: `docker compose ps postgres`
2. Check credentials in `.env`
3. Test connection: `bun cli db:test`
4. Check PostgreSQL logs: `docker compose logs postgres`

### Slow Queries

1. Run `EXPLAIN ANALYZE` on the query
2. Check if indexes are being used
3. Run `ANALYZE` on tables
4. Consider adding/rebuilding indexes

### Partition Issues

1. Check partition list: `\d+ killmails`
2. Create missing partitions: `bun cli db:partitions`
3. Verify partition constraints

### Index Bloat

1. Check index sizes
2. Rebuild indexes: `REINDEX TABLE tablename`
3. Run `VACUUM FULL` (requires downtime)

## Configuration

### postgresql.conf

Required settings:

```
max_locks_per_transaction = 200  # For partitioning
shared_preload_libraries = 'pg_trgm'  # For search
```

### Environment Variables

```bash
DATABASE_URL=postgresql://edk_user:password@localhost:5432/edk
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=edk
POSTGRES_USER=edk_user
POSTGRES_PASSWORD=password
```
