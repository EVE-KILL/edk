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
- **Materialized Views:** Materialized views are **intentionally removed** in favor of direct complex queries against base tables. Do not create them.

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

## Testing

### Running Tests
- Run all tests: `bun test`
- The test runner uses a preload script: `tests/setup.ts`.

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

## Environment Variables
Key variables (see `.env.example`):
- `DATABASE_URL`: Postgres connection string.
- `REDIS_HOST`, `REDIS_PORT`: Redis connection info.
- `TEST_DB_NAME`: Name of the database used for testing (default: `edk_test`).
