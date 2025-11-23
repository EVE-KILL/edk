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
sql`${left} AND ${right}`
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
- **Materialized views:** `bun cli db:refresh` refreshes all MVs (`top_*_weekly`, `celestials`). `kill_list` is now a regular view (not materialized) to avoid storing 90M+ rows. `bun cli sde:refresh-mv` refreshes `celestials` after SDE imports.

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
import { enqueueJob, scheduleJob, JobPriority, QueueType } from './server/helpers/queue';

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
