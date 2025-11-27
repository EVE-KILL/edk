# Development Setup

This guide walks through setting up the development environment for EVE-KILL.

## Prerequisites

- **Bun**: Ensure you have a recent version of Bun installed. You can check with `bun --version`.
- **Docker & Docker Compose**: These are used to provide the necessary services (Postgres, Redis, Typesense) in a containerized environment.
- **`tmux`**: This is only required if you use the `make dev` command to run the full stack in a managed terminal session.

### PostgreSQL Configuration Note

If you are using your own PostgreSQL server instead of the one provided by Docker, you **must** set `max_locks_per_transaction = 200` in your `postgresql.conf`. This is required to handle the large number of table partitions used by the application. The included Docker setup handles this configuration automatically.

## Quick Start (Recommended)

The fastest way to get started is to use the provided `Makefile`.

**1. Configure Environment Variables:**

First, copy the example environment file:

```bash
cp .env.example .env
```

Review the `.env` file and adjust any variables as needed for your local setup.

**2. Bootstrap the Environment:**

This command will start the Docker containers, install dependencies, run database migrations, import the EVE Online SDE, and seed the search index.

```bash
make setup
```

**3. Start the Development Stack:**

This command starts all necessary processes in a `tmux` session, including the Nitro dev server, WebSocket server, queue workers, cron jobs, and the RedisQ listener.

```bash
make dev
```

To detach from the `tmux` session, press `Ctrl+b` then `d`. To stop all processes, re-attach to the session and press `Ctrl+c` in each pane.

## Manual Setup

If you prefer not to use `make`, you can follow these steps to set up the environment manually.

**1. Configure Environment Variables:**

```bash
cp .env.example .env
```

**2. Start Services:**

```bash
docker compose up -d postgres redis typesense
```

**3. Install Dependencies:**

```bash
bun install
```

**4. Prepare the Database:**

```bash
# Apply migrations
bun cli db:migrate

# Create partitions
bun cli db:partitions

# Download and import the EVE SDE
bun cli sde:download

# Refresh materialized views from SDE
bun cli sde:refresh-mv
```

**5. Seed the Search Index:**

```bash
bun cli search:seed
```

**6. Run Application Processes:**

You will need to run each of these commands in a separate terminal.

- **Nitro Dev Server:** `bun dev`
- **WebSocket Server:** `bun ws`
- **Queue Workers:** `bun queue` (or `bun queue <name> --limit 5` to test a single queue)
- **Cron Jobs:** `bun cronjobs`
- **RedisQ Listener:** `bun cli listeners:redisq`

## Environment Variables

The application is configured using environment variables defined in the `.env` file.

- **Postgres:** `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`
- **Redis:** `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_URL`
- **Typesense:** `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, `TYPESENSE_API_KEY`
- **Ingestion/Search:** `REDISQ_ID` (zKillboard queue ID), `IMAGE_SERVER_URL`
- **Tests:** `TEST_DB_NAME` (optional override for the test database name)
