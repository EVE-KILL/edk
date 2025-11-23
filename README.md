# EVE-KILL (EDK)

Self-hosted, EVE Online killboard built with Bun, Nitro, PostgreSQL, Redis, and Typesense.

## Stack

- Runtime: Bun
- Framework: Nitro
- Data: PostgreSQL (`postgres.js`), Redis (BullMQ), Typesense

## Prerequisites

- Bun installed (`bun --version`)
- Docker + Docker Compose (provides Postgres, Redis, Typesense)
- `tmux` (required only for `make dev`)

**Note**: If you're using your own PostgreSQL server (not Docker), you must set `max_locks_per_transaction = 200` in `postgresql.conf` due to the partitioned table structure (60+ partitions). The Docker setup handles this automatically.

## Quick start

1: Copy envs and edit as needed:

```bash
cp .env.example .env
```

2: Bootstrap everything (containers, deps, migrations, SDE import, search seed):

```bash
make setup
```

3: Start the full dev stack (Nitro dev server, WebSocket server, queues, cronjobs, RedisQ listener):

```bash
make dev
```

`make dev` opens a tmux session; exit with `Ctrl+b` then `d` (detach) or `Ctrl+c` in each pane to stop.

## Manual setup (if you skip make)

```bash
cp .env.example .env
docker compose up -d postgres redis typesense
bun install
bun cli db:migrate
bun cli db:partitions
bun cli sde:download
bun cli sde:refresh-mv
bun cli search:seed
```

Then run the app:

- Nitro dev server: `bun dev`
- WebSocket server: `bun ws`
- Queues: `bun queue` (or `bun queue <name> --limit 5` to test a single queue)
- Cron jobs: `bun cronjobs`
- RedisQ listener: `bun cli listeners:redisq`

## Code Quality

This project uses `husky`, `lint-staged`, and `commitlint` to enforce code quality and consistent commit messages.

- **Pre-commit**: Before you commit, `lint-staged` will automatically run `eslint` and `prettier` on any staged `.ts` files. It will also format other file types like JSON and Markdown. Type-checking is not included in the pre-commit hook due to a large number of existing errors, but it is still run as a separate check in CI.
- **Commit Message**: Your commit messages will be linted to ensure they follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format.

These hooks are installed automatically when you run `bun install`.

## Running tests

```bash
bun test
```

Tests preload `tests/setup.ts`, which recreates the test database (`TEST_DB_NAME`, default `edk_test`) and runs migrations automatically.

## Project layout

- `server/` – Nitro routes, plugins (schema migration, db connection), helpers (database, templates, typesense, redis)
- `templates/` and `oldtemplates/` – Handlebars views
- `commands/` – CLI commands loaded by `bun cli`
- `queue/` – BullMQ processors, started via `bun queue`
- `cronjobs/` – Scheduled jobs, run with `bun cronjobs`
- `db/` – SQL migrations (columns use mixed-case and must be quoted in raw SQL)
- `tests/` – Bun tests and fixtures

## Environment

- Postgres: `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_URL`
- Typesense: `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_API_KEY`
- Ingestion/search: `REDISQ_ID` (zKillboard queue ID), `IMAGE_SERVER_URL`
- Tests: `TEST_DB_NAME` (optional override)

## Useful commands

- `bun cli` – shows all available CLI commands
- `bun cli db:migrate` – apply migrations (auto-adds missing columns from SQL files)
- `bun cli db:partitions` – ensure partition tables exist
- `bun cli sde:download` / `bun cli sde:refresh-mv` – pull and hydrate EVE SDE data
- `bun cli search:seed` – rebuild Typesense search index
- `bun cli listeners:redisq` – start the killmail listener

For detailed production deployment instructions, please see the [Production Deployment Guide](./docs/production-deployment.md).
