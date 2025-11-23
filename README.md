# EVE-KILL (EDK)

Self-hosted, EVE Online killboard built with Bun, Nitro, PostgreSQL, Redis, and Typesense.

## Documentation

Comprehensive developer documentation is available in the [`docs/`](./docs) directory.

- **[Development Setup](./docs/development/setup.md)**
- **[Contributing Guide](./CONTRIBUTING.md)**

## Quick Start

For detailed instructions, please see the **[Development Setup](./docs/development/setup.md)** guide.

1.  **Configure Environment:** `cp .env.example .env`
2.  **Bootstrap:** `make setup`
3.  **Run:** `make dev`

## Running Tests

```bash
bun test
```

Tests preload `tests/setup.ts`, which automatically recreates the test database (`TEST_DB_NAME`, default `edk_test`) and runs all migrations.

## Project layout

- `server/` – Nitro routes, plugins (schema migration, db connection), helpers (database, templates, typesense, redis)
- `templates/` and `oldtemplates/` – Handlebars views
- `commands/` – CLI commands loaded by `bun cli`
- `queue/` – BullMQ processors, started via `bun queue`
- `cronjobs/` – Scheduled jobs, run with `bun cronjobs`
- `db/` – SQL migrations (columns use mixed-case and must be quoted in raw SQL)
- `tests/` – Bun tests and fixtures

## Environment

Use `server/helpers/env` for typed, validated access to configuration. Key variables:

- App: `NODE_ENV`, `THEME`, `SITE_TITLE`, `SITE_SUBTITLE`, `IMAGE_SERVER_URL`, `ESI_SERVER_URL`
- Database: `DATABASE_URL`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `ADMIN_DB_NAME`, `ADMIN_DATABASE_URL`, `TEST_DB_NAME`, `POSTGRES_DB`
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDISQ_ID`
- Typesense: `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_API_KEY`
- Rate limits: `RATE_LIMIT_KILLMAIL_WINDOW`, `RATE_LIMIT_KILLMAIL_MAX`, `RATE_LIMIT_DEFAULT_WINDOW`, `RATE_LIMIT_DEFAULT_MAX`
- Tracking & WS: `FOLLOWED_CHARACTER_IDS`, `FOLLOWED_CORPORATION_IDS`, `FOLLOWED_ALLIANCE_IDS`, `WS_PORT`, `WS_HOST`, `WS_PING_INTERVAL`, `WS_PING_TIMEOUT`, `WS_CLEANUP_INTERVAL`

## Useful commands

- `bun cli` – shows all available CLI commands
- `bun cli db:migrate` – apply migrations (auto-adds missing columns from SQL files)
- `bun cli db:partitions` – ensure partition tables exist
- `bun cli sde:download` / `bun cli sde:refresh-mv` – pull and hydrate EVE SDE data
- `bun cli search:seed` – rebuild Typesense search index
- `bun cli listeners:redisq` – start the killmail listener

Production guidance is coming soon™; for now the focus is local/development usage.
