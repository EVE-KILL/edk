# EVE-KILL EDK - GitHub Copilot Instructions

## Project Overview

**EVE-KILL EDK** is a real-time EVE Online killmail tracking and analytics system built on modern infrastructure. The project ingests killmails from multiple sources (WebSocket streams, ESI API), stores them in ClickHouse for high-performance analytics, and provides REST APIs for data access.

### Core Purpose
- Real-time killmail ingestion from EVE-KILL WebSocket feed
- Historical killmail data storage and querying
- Entity (character/corporation/alliance) tracking with background processing
- EVE Online Static Data Export (SDE) management and import
- High-performance analytics on killmail data

---

## Technology Stack

### Runtime & Framework
- **Runtime**: Bun (modern JavaScript runtime)
- **Framework**: Nitro (Universal JavaScript Server)
- **Language**: TypeScript (strict mode enabled)

### Data Layer
- **Primary Database**: ClickHouse (columnar database optimized for analytics)
  - Uses `ReplacingMergeTree` for deduplication with versioning
  - Partitioned by time for optimal query performance
  - Materialized views for ESI format reconstruction
- **Cache/Queue**: Redis (caching layer + BullMQ job queue)
- **Queue System**: BullMQ with Redis backend

### Infrastructure
- Docker Compose setup (ClickHouse + Redis)
- Schema-based migrations tracked in database
- Environment-based configuration

---

## Project Structure

```
/
├── cli.ts                    # CLI entry point with dynamic command loading
├── queue.ts                  # Queue worker entry point with auto-discovery
├── nitro.config.ts          # Nitro server configuration
├── schema.sql               # Complete ClickHouse database schema
├── docker-compose.yml       # Local development infrastructure
│
├── commands/                # CLI commands (auto-loaded by cli.ts)
│   ├── ekws.ts             # EVE-KILL WebSocket listener
│   ├── db/                 # Database commands
│   ├── debug/              # Debug/inspection commands
│   ├── sde/                # SDE management commands
│   └── test/               # Test commands
│
├── queue/                   # Queue processors (auto-loaded by queue.ts)
│   ├── character.ts        # Character entity processor
│   ├── corporation.ts      # Corporation entity processor
│   └── alliance.ts         # Alliance entity processor
│
└── server/                  # Nitro server code
    ├── fetchers/           # API/data fetchers (auto-imported)
    │   ├── killmail.ts    # Killmail fetcher from ESI
    │   ├── character.ts   # Character data fetcher
    │   ├── corporation.ts # Corporation data fetcher
    │   └── alliance.ts    # Alliance data fetcher
    │
    ├── helpers/            # Utility helpers (auto-imported)
    │   ├── cache.ts       # Redis caching helper
    │   ├── database.ts    # ClickHouse database helper
    │   ├── fetcher.ts     # HTTP fetcher with retry logic
    │   ├── logger.ts      # Structured logging helper
    │   ├── queue.ts       # BullMQ queue helper with type safety
    │   └── sde/           # SDE (Static Data Export) helpers
    │       ├── configs.ts # SDE table field mappings
    │       ├── fetcher.ts # SDE download and import manager
    │       ├── parser.ts  # JSONL streaming parser
    │       └── types.ts   # SDE type definitions
    │
    ├── models/             # Data models (auto-imported)
    │   ├── killmails.ts          # Killmail storage/retrieval
    │   ├── killmails-esi.ts      # ESI format killmail queries
    │   ├── solarSystems.ts       # Solar system data
    │   ├── regions.ts            # Region data
    │   ├── constellations.ts     # Constellation data
    │   ├── types.ts              # Item types
    │   ├── groups.ts             # Item groups
    │   └── [...20+ more SDE models]
    │
    ├── plugins/            # Nitro plugins (auto-loaded)
    │   ├── clickhouse.ts         # ClickHouse client initialization
    │   └── schema-migration.ts   # Database schema migration
    │
    ├── middleware/         # HTTP middleware
    │   └── request-logger.ts     # Request logging
    │
    └── routes/             # API routes (file-based routing)
        ├── health.ts              # Health check endpoint
        ├── index.ts               # Root endpoint
        ├── schema.ts              # Schema info endpoint
        └── api/
            ├── example.ts
            └── killmail/
                └── [id]/
                    └── esi.get.ts # GET /api/killmail/:id/esi
```

---

## Architecture Patterns

### 1. **Auto-Discovery & Dynamic Loading**

The project uses dynamic module loading for extensibility:

**CLI Commands** (`cli.ts`):
- Scans `commands/` directory recursively
- Loads `.ts`/`.js` files as commands
- Nested directories create namespaced commands (e.g., `sde:download`)
- Commands export: `{ description, options?, action }`

**Queue Processors** (`queue.ts`):
- Auto-discovers queue processors in `queue/` directory
- Each processor exports: `{ name, processor, createWorker }`
- Workers can be started individually: `bun queue character`
- Or all together: `bun queue`

**Nitro Auto-Imports** (`nitro.config.ts`):
- Auto-imports from `server/helpers/**`, `server/models/**`, `server/fetchers/**`
- Available globally in all server code without explicit imports

### 2. **Database Patterns**

**ClickHouse Schema Design**:
- `ReplacingMergeTree` for versioned deduplication
- Time-based partitioning (`PARTITION BY toYYYYMM(killmailTime)`)
- Granular indexes for common query patterns
- Views for data denormalization (e.g., `killmails_esi`)

**Database Helper** (`server/helpers/database.ts`):
```typescript
// Singleton instance with convenient methods
const result = await database.query('SELECT ...')
const row = await database.queryOne('SELECT ...')
const count = await database.count('tableName', 'where clause')
await database.insert('tableName', data)
await database.bulkInsert('tableName', dataArray)
```

**Model Pattern**:
Models export functions for data access, not classes:
```typescript
export async function getKillmail(id: number): Promise<ESIKillmail | null>
export async function storeKillmail(data: ESIKillmail): Promise<void>
```

### 3. **Queue System Architecture**

**Type-Safe Queue Operations** (`server/helpers/queue.ts`):
```typescript
enum QueueType {
  CHARACTER = 'character',
  CORPORATION = 'corporation',
  ALLIANCE = 'alliance'
}

interface QueueJobData {
  [QueueType.CHARACTER]: { id: number }
  // ...
}

// Type-safe enqueuing
await enqueueJob(QueueType.CHARACTER, { id: 123 })
await enqueueJobMany(QueueType.CHARACTER, [{ id: 1 }, { id: 2 }])
```

**Queue Processors**:
- Each queue processor is a separate file in `queue/`
- Implements retry logic via BullMQ configuration
- Processes entity updates in background
- Concurrency configured per-worker

### 4. **SDE (Static Data Export) Management**

**SDE Fetcher** (`server/helpers/sde/fetcher.ts`):
- Downloads latest EVE Online static data from CCP
- Supports ETag-based caching
- Extracts JSONL files
- Streaming JSONL parser for memory efficiency
- Generic table import with field mappings
- Build number tracking to avoid re-imports
- Force reimport mode for testing/updates

**SDE Table Pattern**:
```typescript
await sdeFetcher.importTable('mapSolarSystems', [
  { source: '_key', target: 'solarSystemId', type: 'number' },
  { source: 'name.en', target: 'name', type: 'string' },
  // ...
])
```

### 5. **API Fetcher Pattern**

**HTTP Fetcher** (`server/helpers/fetcher.ts`):
```typescript
// Generic fetcher with retry logic
const response = await fetcher<T>(url, options)

// ESI-specific helper
const killmail = await fetchESI<ESIKillmail>(`/killmails/${id}/${hash}/`)

// EVE-KILL specific helper
const data = await fetchEveKill<T>('/path')
```

Features:
- Automatic retry with exponential backoff
- Timeout handling
- Standard User-Agent headers
- JSON parsing with error handling

### 6. **WebSocket Integration**

**EVE-KILL WebSocket** (`commands/ekws.ts`):
- Connects to `wss://ws.eve-kill.com/killmails`
- Subscribes to real-time killmail stream
- Deduplication check before processing
- Optional filtering by entity IDs
- Auto-reconnection with backoff
- Entity extraction and queue job creation
- Statistics tracking

### 7. **Nitro Server Configuration**

**Key Features**:
- WebSocket support (experimental)
- Redis-backed caching for routes
- Route-specific cache rules
- Auto-imports from server directories
- CORS enabled for API routes
- Compression (gzip, brotli)

**Route Rules**:
```typescript
'/api/killmail/*/esi': { cache: { maxAge: 3600, base: "redis" } }
'/api/**': { cors: true, cache: { maxAge: 60, base: "redis" } }
```

---

## Key Data Models

### Killmail Storage

**Database Tables**:
1. `killmails` - Core killmail with victim info
2. `attackers` - One row per attacker (denormalized)
3. `items` - One row per item (denormalized)

**ESI Format View** (`killmails_esi`):
- Reconstructs ESI API format from denormalized data
- Uses subqueries to aggregate attackers and items as JSON arrays
- Accessed via `getKillmail(id)` in models

**Storage Flow**:
```
WebSocket → fetchAndStoreKillmail() → storeKillmail() → ClickHouse
                                    ↓
                            Entity Extraction
                                    ↓
                            Queue Jobs (character/corp/alliance)
```

### SDE Tables

**Map Data**: `mapSolarSystems`, `mapRegions`, `mapConstellations`, `mapStargates`, `mapStars`, `mapPlanets`, `mapMoons`, `mapAsteroidBelts`

**Type System**: `types`, `groups`, `categories`, `marketGroups`, `metaGroups`

**NPCs**: `npcCorporations`, `npcStations`, `npcCharacters`

**Character Data**: `factions`, `races`, `bloodlines`, `ancestries`

**Dogma**: `dogmaAttributes`, `dogmaEffects`

**Cosmetics**: `skins`

All SDE tables use `ReplacingMergeTree(version)` for update handling.

---

## Environment Variables

```bash
# ClickHouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=edk_user
CLICKHOUSE_PASSWORD=edk_password
CLICKHOUSE_DB=edk

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Node/Bun
NODE_ENV=development
```

---

## Common Commands

### Development
```bash
bun run dev           # Start Nitro dev server
bun cli ekws          # Start WebSocket listener
bun queue             # Start all queue workers
bun queue character   # Start specific queue worker
```

### SDE Management
```bash
bun cli sde:download          # Download latest SDE
bun cli sde:inspect           # Inspect SDE tables
bun cli debug:inspect-sde     # Debug SDE data
```

### Database
```bash
bun cli db:test               # Test database connection
```

### Testing
```bash
bun test                      # Run tests
bun run type-check            # TypeScript type checking
```

---

## Code Style & Conventions

### TypeScript
- **Strict mode** enabled
- **No unused locals** (enforced)
- Use `async/await` for all async operations
- Prefer functional patterns over classes (except for complex state)
- Type everything explicitly when not obvious

### Naming Conventions
- **Files**: kebab-case (`solar-systems.ts`)
- **Functions**: camelCase (`getSolarSystem`)
- **Types/Interfaces**: PascalCase (`ESIKillmail`)
- **Constants**: UPPER_SNAKE_CASE (`SDE_BASE_URL`)
- **Database fields**: camelCase in TypeScript, snake_case in ClickHouse views

### Database Queries
- Use parameterized queries: `{param:Type}` syntax
- Always specify types in parameters: `UInt32`, `String`, `Float64`
- Use prepared statements via `database.query(sql, params)`
- Batch inserts via `database.bulkInsert()`

### Error Handling
- Use structured logging via `logger` helper
- Catch and log errors at appropriate boundaries
- Queue processors should throw for retry logic
- API routes should use `createError()` from H3

### Logging
```typescript
logger.info('Message', { data: value })
logger.warn('Warning', { context })
logger.error('Error occurred', { error: err })
logger.success('Operation completed')
logger.debug('Debug info', { details })
```

---

## Performance Considerations

### ClickHouse Optimization
- Use `OPTIMIZE TABLE` after bulk imports to merge parts
- Partition tables by time for query pruning
- Use appropriate indexes (minmax, set, bloom_filter)
- Avoid `SELECT *` in production queries
- Use materialized views for complex aggregations

### Queue Processing
- Batch enqueue operations with `enqueueJobMany()`
- Configure concurrency per worker based on API limits
- Use job deduplication via jobId
- Set appropriate retry strategies

### Caching Strategy
- Route-level caching via Nitro config
- Redis-backed cache for expensive queries
- ETag support for SDE downloads
- Build number tracking to avoid re-imports

### Memory Management
- Stream JSONL parsing for large SDE files
- Batch database inserts (typically 1000 rows)
- Clear arrays after batch operations
- Use appropriate ClickHouse column types (UInt32 vs UInt64)

---

## Testing & Debugging

### Debug Commands
- `bun cli debug:check-data` - Verify data integrity
- `bun cli debug:inspect-sde` - Inspect SDE structure
- `bun cli test:killmail-reconstruct` - Test ESI format reconstruction

### Health Checks
- `GET /health` - Server health endpoint
- `GET /schema` - Schema information
- Check ClickHouse: `await database.ping()`
- Check Redis: BullMQ connection status

### Common Issues

**ClickHouse Connection**:
- Verify docker-compose services are running
- Check credentials in environment variables
- Test with `bun cli db:test`

**Queue Processing**:
- Check Redis connection
- Verify queue worker is running
- Check BullMQ job states in Redis

**SDE Import**:
- Ensure adequate disk space (~500MB per build)
- Verify network access to developers.eveonline.com
- Check extraction succeeded (files in `.data/sde/extracted/`)

---

## API Design Patterns

### Route Structure
- File-based routing in `server/routes/`
- Dynamic parameters: `[id]/` directories
- Method handlers: `*.get.ts`, `*.post.ts`, etc.
- Use `defineEventHandler()` for all routes

### Response Format
- Return raw data objects (Nitro handles serialization)
- Use `createError()` for errors with proper status codes
- Cache headers managed via route rules
- CORS automatically handled for `/api/**`

### Request Handling
```typescript
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const body = await readBody(event)

  // Validate input
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing parameter'
    })
  }

  // Process and return
  return await getData(id)
})
```

---

## Database Schema Design Principles

### Denormalization Strategy
- Store complete killmail data across 3 tables
- One-to-many relationships become separate tables
- Use views to reconstruct complex formats
- Duplicate frequently-joined data

### Versioning & Updates
- All SDE tables use `version` field (Unix timestamp)
- `ReplacingMergeTree(version)` keeps latest version
- Run `OPTIMIZE TABLE` to apply deduplication
- Track imports in `config` table

### Query Optimization
- Index commonly filtered fields
- Use granularity 3 for most indexes
- Partition by time for killmail tables
- Use UInt32 for IDs (save space vs UInt64)

---

## Future Development Notes

### Planned Features
- Character/corporation/alliance entity tables
- Historical tracking of entity changes
- Additional SDE tables (blueprints, etc.)
- Killmail statistics and aggregations
- WebSocket API for real-time updates

### Extension Points
- Add new queue types in `queue/` directory
- Add new CLI commands in `commands/` directory
- Add new API routes in `server/routes/api/`
- Add new SDE tables via `importTable()` method
- Add new fetchers in `server/fetchers/`

### Maintenance Tasks
- Regular SDE updates (monthly)
- ClickHouse table optimization
- Redis cache cleanup
- Database backup strategy
- Monitor queue job failures

---

## Important Gotchas

1. **ClickHouse DateTime**: Use ISO 8601 format or Unix timestamps, not JavaScript Date objects
2. **Bun vs Node**: Some Node packages may not work, use Bun-compatible alternatives
3. **Fish Shell**: No heredocs, use `printf` or `echo` for multi-line commands
4. **Nitro Auto-imports**: Don't explicitly import auto-imported helpers/models
5. **Queue Job IDs**: Must be unique, use `${queueType}:${JSON.stringify(data)}`
6. **SDE Language Fields**: Extract with `extractLanguageField(field, 'en')`
7. **ClickHouse NULL**: Use `Nullable(Type)` in schema, handle nulls explicitly
8. **Array Fields**: ClickHouse arrays are 1-indexed, not 0-indexed
9. **ReplacingMergeTree**: Deduplication happens on merge, not on insert
10. **ESI Rate Limits**: Respect CCP's rate limits (150 req/s burst, throttle down)

---

## Contributing Guidelines

When adding new features:
1. **Follow existing patterns** - Look at similar code first
2. **Use auto-discovery** - Add to appropriate directory for auto-loading
3. **Type everything** - No `any` types unless absolutely necessary
4. **Log appropriately** - Use structured logging with context
5. **Handle errors** - Catch, log, and either retry or fail gracefully
6. **Batch operations** - Use bulk inserts and queue batch enqueuing
7. **Test locally** - Use docker-compose for full stack testing
8. **Document complex logic** - Add comments for non-obvious code
9. **Update schema** - Keep `schema.sql` in sync with changes
10. **Version your data** - Use version field for updatable tables

---

## Resources

- **EVE ESI API**: https://esi.evetech.net/ui/
- **EVE SDE**: https://developers.eveonline.com/resource/resources
- **ClickHouse Docs**: https://clickhouse.com/docs/
- **Nitro Docs**: https://nitro.build/
- **BullMQ Docs**: https://docs.bullmq.io/
- **Bun Docs**: https://bun.sh/docs

---

## Quick Reference

### Database Helper
```typescript
await database.query<T>('SELECT ...', { params })
await database.queryOne<T>('SELECT ...', { params })
await database.queryValue<T>('SELECT ...', { params })
await database.execute('INSERT ...', { params })
await database.insert('table', data)
await database.bulkInsert('table', [data])
await database.count('table', 'where', { params })
await database.ping()
```

### Queue Helper
```typescript
await enqueueJob(QueueType.CHARACTER, { id: 123 })
await enqueueJobMany(QueueType.CHARACTER, [{ id: 1 }])
await getQueueStats(QueueType.CHARACTER)
```

### Logger
```typescript
logger.info('msg', { data })
logger.warn('msg', { data })
logger.error('msg', { data })
logger.success('msg', { data })
logger.debug('msg', { data })
```

### Fetcher
```typescript
await fetcher<T>(url, options)
await fetchESI<T>('/path')
await fetchEveKill<T>('/path')
```

---

**Last Updated**: October 2025
**Maintainer**: EVE-KILL Team
**Version**: 0.1.0-alpha
