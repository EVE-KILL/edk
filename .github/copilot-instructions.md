# EVE-KILL EDK - GitHub Copilot Instructions

## Project Overview

**EVE-KILL EDK** is a real-time EVE Online killmail tracking and analytics system built on modern infrastructure. The project ingests killmails from multiple sources (WebSocket streams, ESI API), stores them in PostgreSQL, and provides REST APIs and server-side rendered pages for data access.

### Core Purpose
- Real-time killmail ingestion from EVE-KILL WebSocket feed
- Historical killmail data storage and querying
- Entity (character/corporation/alliance) tracking with background processing
- EVE Online Static Data Export (SDE) management and import
- Server-side rendered frontend with Handlebars templates
- High-performance data access and analytics

---

## Technology Stack

### Runtime & Framework
- **Runtime**: Bun (modern JavaScript runtime - use `bun` for all scripts and testing)
- **Framework**: Nitro (Universal JavaScript Server for server-side application)
- **Language**: TypeScript (strict mode enabled)
- **Templating**: Handlebars (server-side rendering)

### Data Layer
- **Primary Database**: PostgreSQL (with `postgres.js` driver)
  - Mixed-case column names (camelCase) - **MUST use double quotes in raw SQL**
  - Schema migrations tracked in `migrations` table
  - Automatic column addition via schema migration plugin
- **Cache/Queue**: Redis (caching layer + BullMQ job queue)
- **Queue System**: BullMQ with Redis backend

### Infrastructure
- Docker Compose setup (PostgreSQL + Redis)
- SQL migration files in `db/` directory
- Automatic schema migration on startup
- Environment-based configuration

---

## Project Structure

```
/
├── cli.ts                    # CLI entry point with dynamic command loading
├── queue.ts                  # Queue worker entry point with auto-discovery
├── cronjobs.ts              # Cron job runner with auto-discovery
├── nitro.config.ts          # Nitro server configuration
├── docker-compose.yml       # Local development infrastructure (PostgreSQL + Redis)
├── AGENTS.md                # Agent instructions (always up-to-date - refer to this)
│
├── db/                      # PostgreSQL migration files
│   ├── 01-create-migrations-table.sql
│   ├── 05-create-config-table.sql
│   ├── 10-create-killmail-tables.sql
│   ├── 11-create-entity-tables.sql
│   ├── 12-create-prices-table.sql
│   └── 20-25-create-sde-*.sql  # SDE table migrations
│
├── commands/                # CLI commands (auto-loaded by cli.ts)
│   ├── backfill.ts         # Backfill operations
│   ├── ekws.ts             # EVE-KILL WebSocket listener
│   ├── purge-db.ts         # Database purge utility
│   ├── db/                 # Database commands
│   ├── debug/              # Debug/inspection commands
│   ├── sde/                # SDE management commands
│   └── test/               # Test commands
│
├── cronjobs/                # Cron job processors (auto-loaded)
│   └── database-health-check.ts
│
├── queue/                   # Queue processors (auto-loaded by queue.ts)
│   ├── character.ts        # Character entity processor
│   ├── corporation.ts      # Corporation entity processor
│   ├── alliance.ts         # Alliance entity processor
│   ├── killmail.ts         # Killmail processor
│   └── price.ts            # Price data processor
│
├── templates/               # Handlebars templates
│   ├── default/            # Default theme
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── partials/
│   │   └── static/
│   └── test/               # Test theme
│
├── tests/                   # Bun Test files
│   ├── setup.ts            # Test setup (auto-drops/creates test DB)
│   ├── *.test.ts           # Test files
│   └── helpers/            # Test helpers
│
└── server/                  # Nitro server code
    ├── fetchers/           # API/data fetchers (auto-imported)
    │   ├── killmail.ts    # Killmail fetcher from ESI
    │   ├── character.ts   # Character data fetcher
    │   ├── corporation.ts # Corporation data fetcher
    │   ├── alliance.ts    # Alliance data fetcher
    │   └── price.ts       # Price data fetcher
    │
    ├── helpers/            # Utility helpers (auto-imported)
    │   ├── cache.ts       # Redis caching helper
    │   ├── database.ts    # PostgreSQL database helper (DatabaseHelper class)
    │   ├── fetcher.ts     # HTTP fetcher with retry logic
    │   ├── logger.ts      # Structured logging helper
    │   ├── queue.ts       # BullMQ queue helper with type safety
    │   ├── templates.ts   # Handlebars template rendering
    │   ├── pagination.ts  # Pagination helper
    │   ├── time.ts        # Time utilities
    │   ├── topbox.ts      # Top box helper
    │   ├── format-top-boxes.ts
    │   └── sde/           # SDE (Static Data Export) helpers
    │
    ├── models/             # Data models (auto-imported)
    │   ├── killmails.ts           # Killmail storage/retrieval
    │   ├── killmailsESI.ts        # ESI format killmail queries
    │   ├── killlist.ts            # Killmail list queries
    │   ├── characters.ts          # Character entities
    │   ├── corporations.ts        # Corporation entities
    │   ├── alliances.ts           # Alliance entities
    │   ├── prices.ts              # Price data
    │   ├── solarSystems.ts        # Solar system data
    │   ├── regions.ts             # Region data
    │   ├── constellations.ts      # Constellation data
    │   ├── types.ts               # Item types
    │   ├── groups.ts              # Item groups
    │   └── [...30+ more SDE and entity models]
    │
    ├── plugins/            # Nitro plugins (auto-loaded)
    │   └── schema-migration.ts   # PostgreSQL schema migration
    │
    ├── middleware/         # HTTP middleware
    │   └── request-logger.ts     # Request logging
    │
    └── routes/             # Routes (file-based routing)
        ├── index.ts               # Homepage
        ├── health.ts              # Health check endpoint
        └── api/                   # API routes
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

**PostgreSQL with postgres.js**:
- Uses `postgres.js` driver for high-performance PostgreSQL access
- Mixed-case column names (camelCase) - **MUST use double quotes in raw SQL**
- Migrations in `db/` directory (numbered SQL files)
- Automatic schema migration on startup adds missing columns
- No materialized views - direct complex queries against base tables

**Database Helper** (`server/helpers/database.ts`):
```typescript
// DatabaseHelper class provides convenient methods
const sql = database.sql // Access raw postgres.js sql client

// Common methods:
await database.insert('tableName', data)
await database.bulkInsert('tableName', [data])
await database.bulkUpsert('tableName', [data], ['conflictColumn'])
await database.queryOne('SELECT ...')
await database.queryMany('SELECT ...')
// Use sql`` for raw queries with proper escaping
```

**Important: Column Name Quoting**:
- When writing **Raw SQL**, wrap mixed-case columns in double quotes: `SELECT "killmailId" FROM ...`
- When using `postgres.js` with objects, ensure keys match exactly (camelCase)
- `DatabaseHelper` methods handle quoting automatically

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

**SDE System**:
- Downloads latest EVE Online static data from CCP
- SDE tables defined in migration files (`db/20-25-create-sde-*.sql`)
- Import logic in `server/helpers/sde/`
- Supports versioning and updates
- Build number tracking to avoid re-imports

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
WebSocket → fetchAndStoreKillmail() → storeKillmail() → PostgreSQL
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

All tables use PostgreSQL with proper indexing and constraints.

---

## Environment Variables

```bash
# PostgreSQL
DATABASE_URL=postgresql://edk_user:edk_password@localhost:5432/edk

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Testing
TEST_DB_NAME=edk_test

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
- **Database fields**: camelCase in TypeScript (use double quotes in raw SQL)

### Database Queries
- Use `postgres.js` tagged templates for safe queries
- Always use double quotes for mixed-case column names in raw SQL
- Use `DatabaseHelper` methods when possible
- Batch inserts via `database.bulkInsert()` or `database.bulkUpsert()`

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

### PostgreSQL Optimization
- Use proper indexes on frequently queried columns
- Batch inserts for bulk operations
- Use transactions for multiple related operations
- Avoid `SELECT *` in production queries
- Use direct complex queries instead of materialized views

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
- Use appropriate data types (integer vs bigint)

---

## Testing & Debugging

### Testing
- **Run all tests**: `bun test`
- **Test setup**: `tests/setup.ts` automatically drops/creates test DB and runs migrations
- **Test files**: Place in `tests/` directory
- **Do not** manually migrate test DB - setup script handles it

### Debug Commands
- `bun cli debug:check-data` - Verify data integrity
- `bun cli debug:inspect-sde` - Inspect SDE structure
- `bun cli test:killmail-reconstruct` - Test ESI format reconstruction

### Health Checks
- `GET /health` - Server health endpoint
- Check PostgreSQL: `await database.sql`SELECT 1``
- Check Redis: BullMQ connection status

### Common Issues

**PostgreSQL Connection**:
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
- Check extraction succeeded

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

### Migrations
- Migrations located in `db/` directory
- `server/plugins/schema-migration.ts` automatically adds missing columns
- Relies on checksums stored in `migrations` table
- Test environment auto-migrates via `tests/setup.ts`

### Query Optimization
- Index commonly filtered fields
- Use proper PostgreSQL indexes
- Construct dynamic queries with `postgres.js` template literals
- Use arrays of fragments for dynamic filters

---

## Future Development Notes

### Planned Features
- Enhanced entity tracking and statistics
- Additional SDE tables (blueprints, etc.)
- Killmail statistics and aggregations
- WebSocket API for real-time updates
- Advanced analytics and reporting

### Extension Points
- Add new queue types in `queue/` directory
- Add new CLI commands in `commands/` directory
- Add new API routes in `server/routes/api/`
- Add new SDE tables via migration files
- Add new fetchers in `server/fetchers/`
- Add new templates in `templates/` directory

### Maintenance Tasks
- Regular SDE updates (monthly)
- Redis cache cleanup
- Database backup strategy
- Monitor queue job failures
- PostgreSQL vacuum and maintenance

---

## Important Gotchas

1. **PostgreSQL Column Quoting**: Mixed-case columns MUST be double-quoted in raw SQL
2. **Bun vs Node**: Some Node packages may not work, use Bun-compatible alternatives
3. **Fish Shell**: No heredocs, use `printf` or `echo` for multi-line commands
4. **Nitro Auto-imports**: Don't explicitly import auto-imported helpers/models
5. **Queue Job IDs**: Must be unique, use `${queueType}:${JSON.stringify(data)}`
6. **SDE Language Fields**: Extract with appropriate parsing logic
7. **postgres.js**: Use tagged templates for safe queries
8. **Test Database**: `tests/setup.ts` handles all test DB setup automatically
9. **Migrations**: Run automatically on server startup via schema migration plugin
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
9. **Update migrations** - Add new migrations in `db/` for schema changes
10. **Test your changes** - Write tests and ensure they pass

---

## Resources

- **EVE ESI API**: https://esi.evetech.net/ui/
- **EVE SDE**: https://developers.eveonline.com/resource/resources
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **postgres.js Docs**: https://github.com/porsager/postgres
- **Nitro Docs**: https://nitro.build/
- **BullMQ Docs**: https://docs.bullmq.io/
- **Bun Docs**: https://bun.sh/docs
- **Handlebars Docs**: https://handlebarsjs.com/

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
