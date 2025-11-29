# Agent Instructions

This file contains instructions and context for AI agents working on this codebase.

## Tech Stack

- **Runtime:** Bun (Use `bun` for scripts and testing).
- **Framework:** Nitro (Server-side application).
- **Database:** PostgreSQL (Driver: `postgres.js`).
- **Queue:** BullMQ (Redis).
- **Testing:** Bun Test.
- **Templating:** Handlebars.

## Project Structure

- `server/`: Nitro server application code.
  - `routes/`: File-based routing.
  - `helpers/`: Shared utilities (e.g., `database.ts`, `templates.ts`).
  - `plugins/`: Nitro plugins (e.g., schema migration, db connection).
- `db/`: SQL migration files.
- `tests/`: Test files (using Bun Test).
- `commands/`: CLI scripts.

## Database

### Connection & Driver

- The project uses `postgres.js`.
- **Helper:** Use `server/helpers/database.ts` (`DatabaseHelper`) for interactions. It exposes `sql` for raw queries if needed.

### Case Sensitivity & Quoting

- **Important:** Many tables use mixed-case column names (e.g., `killmailId`, `solarSystemId`).
- These are defined with double quotes in the migration files (e.g., `"killmailId"`).
- **Implication:**
  - When writing **Raw SQL**, you **MUST** wrap column names in double quotes (e.g., `SELECT "killmailId" FROM ...`).
  - When using `postgres.js` tagged templates with objects (e.g., `sql(data)`), ensure the object keys match the column names exactly (camelCase). The driver handles the quoting.
  - When using `DatabaseHelper` methods (like `bulkUpsert`), ensuring keys match the schema is sufficient.

### Migrations

- Migrations are located in `db/`.
- The system (`server/plugins/schema-migration.ts`) automatically adds missing columns if they exist in the SQL files but not in the DB.
- It relies on checksums stored in the `migrations` table.

### Dynamic Queries

- Use `postgres.js` template literals for safe dynamic queries.
- Construct arrays of fragments for dynamic filters rather than concatenating strings.
- **Never** pass an array of condition fragments to `database.sql(array,'...')` with `'AND'` (including the leading/trailing spaces) or similar separators expecting it to join the fragments. postgres.js treats the array entries as identifiers and calls `str.replace` on them, which blows up at runtime and also causes our DB proxy to try to execute partial fragments, triggering Postgres syntax errors. Instead, filter out falsy fragments and reduce the remaining `sql`` blocks manually, for example:

```ts
sql`${left} AND ${right}`;
```

## Testing

### Running Tests

- Run all tests: `bun test` (configured via `bunfig.toml` to preload `tests/setup.ts`).

### Test Environment

- `tests/setup.ts` automatically:
  1. Drops and recreates the test database (default: `edk_test`).
  2. Runs all migrations from `db/`.
- **Do not** manually try to migrate the test DB; the script handles it.

### Writing Tests

- Place tests in `tests/`.
- Import `database` from `server/helpers/database` to interact with the DB.
- Use `tests/helpers/seed.ts` (if relevant) to populate data. Note that `bulkUpsert` is available for seeding.

## Frontend / Templating

- **Handlebars** is used for server-side rendering.
- **Context Injection:** The `render` function in `server/helpers/templates.ts` injects `data` properties directly into the root context (`...data`). This supports legacy templates that expect flat variables.
- If you add new data to a view, ensure it is passed correctly to the `render` function.

## Development

- **Setup:** Run `bun install` to install dependencies.
- **Start Dev Server:** `bun dev`
- **Run Tests:** `bun test`
- **Formatting/Linting:** Currently no linter/formatter is strictly configured, but follow existing code style.

## CLI & Tooling

- **Bun scripts:** Use `bun` (not npm/yarn); `bun test` is the canonical test entrypoint.
- **Docker:** `docker compose up -d postgres redis` for local services.
- **Makefile:** `make setup` (full env bootstrap; heavy, runs once), `make migrate`, `make import-sde`, `make reset` (stops containers and wipes `.data/`), `make wait-for-services`, `make dev` (`make dev-tmux` alias; interactive tmux session for dev/ws/queue/cronjobs/redisq; only for local use, not CI; auto-runs `make setup` once via `.data/.configured` flag).
- **Local services:** Postgres, Redis, and Typesense are already installed/configured in the environment; `docker compose up` will bring them online if needed.
- **Materialized views:** `bun cli db:refresh` dynamically discovers and refreshes all materialized views. Use `bun cli db:refresh --list` to see available views. Refresh specific views with `bun cli db:refresh <view_name>`. War statistics MVs are refreshed hourly via cron. `kill_list` is a regular view (not materialized) to avoid storing 90M+ rows.

## Performance Tracking

The project includes automatic performance tracking for routes to measure query execution times, template rendering, and overall page load times.

### How Performance Tracking Works

- **Automatic tracking:** Performance metrics are automatically collected via the `requestContext` middleware
- **Database queries:** All queries through `database.query()`, `database.find()`, `database.findOne()`, etc. are automatically tracked
- **Metrics displayed:** Performance data appears in the footer of pages (in development/debug mode) showing:
  - Total page load time
  - Query count and average database time
  - Template rendering time
  - Layout rendering time

### Using Performance Tracking in Routes

**✅ CORRECT - Database queries are tracked:**

```typescript
// Use database.query() or other database helper methods
const result = await database.query<MyType>(
  `SELECT * FROM table WHERE id = :id`,
  { id: 123 }
);
```

**❌ WRONG - Bypasses tracking:**

```typescript
// DO NOT use database.sql directly - it bypasses performance tracking
const sql = database.sql;
const result = await sql`SELECT * FROM table WHERE id = ${id}`;
```

### Wrapping Operations with track()

For custom tracking of application logic (non-database operations):

```typescript
import { track } from '../utils/performance-decorators';

// Track parallel queries
const [data1, data2] = await track(
  'route:parallel_queries',
  'database',
  async () => {
    return await Promise.all([
      database.query('SELECT ...'),
      database.query('SELECT ...'),
    ]);
  }
);

// Track data transformation
const processedData = await track(
  'route:transform_data',
  'application',
  async () => {
    return data.map(transformFn);
  }
);
```

### Performance Best Practices

1. **Always use `database.query()`** instead of `database.sql` in routes to ensure queries are tracked
2. **Use `track()` for application logic** to measure non-database operations
3. **Group related operations** under meaningful span names (e.g., `about:get_db_counts`, `frontpage:parallel_queries`)
4. **Check the footer** during development to verify performance metrics are being collected

## Environment Variables

Key variables (see `.env.example`):

- `DATABASE_URL`: Postgres connection string.
- `REDIS_HOST`, `REDIS_PORT`: Redis connection info.
- `TEST_DB_NAME`: Name of the database used for testing (default: `edk_test`).

## Queue Features

The BullMQ job queueing system is enhanced with several features to provide fine-grained control over job execution, including priorities, delays, and recurring schedules.

### Priorities

The queue utilizes a priority system to ensure that real-time data is processed faster than backfills or batch updates.

- **`JobPriority.HIGH` (1):** For jobs that need immediate processing, like real-time killmails from WebSocket (`ekws.ts`) and RedisQ (`redisq.ts`) listeners.
- **`JobPriority.NORMAL` (5):** The default for most background tasks, such as backfilling historical killmails (`zkillboard.ts`, `eve-kill.ts`).
- **`JobPriority.LOW` (10):** For non-essential or batch tasks, like updating entity information after a killmail is posted (`post.post.ts`).

### Delayed Jobs

Jobs can be delayed to postpone their execution. This is useful for rate-limiting, backoff strategies, or simply deferring a task.

- **Use Case:** Entity update jobs are delayed by 10 seconds to avoid interfering with higher-priority tasks.

### Scheduled (Recurring) Jobs

Jobs can be scheduled to run on a recurring basis, similar to cron jobs. This is ideal for periodic maintenance, data refreshes, and other regular tasks.

- **Use Case:** A daily job can be scheduled to refresh market prices.

### How to Use

All queueing options can be passed through the `JobOptions` object.

```typescript
import {
  enqueueJob,
  scheduleJob,
  JobPriority,
  QueueType,
} from './server/helpers/queue';

// High-priority job
await enqueueJob(
  QueueType.KILLMAIL,
  { killmailId, hash },
  { priority: JobPriority.HIGH }
);

// Low-priority, delayed job
await enqueueJobMany(
  QueueType.CHARACTER,
  [{ id: 123 }, { id: 456 }],
  { priority: JobPriority.LOW, delay: 10000 } // 10-second delay
);

// Scheduled recurring job (daily at midnight)
await scheduleJob(
  QueueType.PRICE,
  'daily-price-update',
  { typeId: 0 }, // Example data
  {
    priority: JobPriority.LOW,
    repeat: {
      cron: '0 0 * * *',
    },
  }
);
```

## AI Tools

### Price Fitting Tool

**Purpose:** Calculate the ISK value of ship fittings or individual items using database prices.

**Endpoint:** `POST /api/ai/price-fitting`

**When to use:**

- User asks "how much is X worth?"
- User pastes an EFT fitting to price
- User asks about ship/item/fitting value

**Request:**

```json
{
  "text": "Item name or EFT fitting",
  "regionId": 10000002 // Optional, defaults to Jita
}
```

**Response:**

```json
{
  "type": "fitting" | "item",
  "data": {
    "totalValue": 1234567890.00,
    "itemsFound": 25,
    "itemsNotFound": 0,
    ...
  },
  "html": "Pretty formatted card"
}
```

**Examples:**

```bash
# Simple item
curl -X POST localhost:3000/api/ai/price-fitting \
  -H "Content-Type: application/json" \
  -d '{"text": "Raven"}'

# EFT fitting
curl -X POST localhost:3000/api/ai/price-fitting \
  -H "Content-Type: application/json" \
  -d '{"text": "[Golem, My Fit]\\nModule\\n\\nModule..."}'
```

**Implementation:**

- `server/helpers/eft-parser.ts` - Parses EFT format
- `server/helpers/fitting-pricer.ts` - Calculates values from `prices` table
- `server/routes/api/ai/price-fitting.post.ts` - API endpoint

# Important things to keep in mind

1. Do not start the dev server, ever - assume that it is running. If not, ask for it
2. To run queries against the database, please use `bun cli db:test --query <query>`
