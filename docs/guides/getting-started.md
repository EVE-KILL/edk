# Getting Started

This guide walks you through setting up a development environment for EVE-KILL.

## Prerequisites

- **Bun** - A fast JavaScript runtime. Check with `bun --version`
- **Docker & Docker Compose** - For running PostgreSQL and Redis
- **tmux** - Optional, only needed for `make dev`

### PostgreSQL Note

If using your own PostgreSQL instead of Docker, set `max_locks_per_transaction = 200` in `postgresql.conf`. This handles the table partitions used by the application.

## Quick Start

The fastest way to get started:

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Bootstrap everything (Docker, migrations, SDE import)
make setup

# 3. Start development stack in tmux
make dev
```

To detach from tmux: `Ctrl+b` then `d`. To stop: re-attach and `Ctrl+c` in each pane.

## Manual Setup

If you prefer not to use `make`:

```bash
# 1. Configure environment
cp .env.example .env

# 2. Start services
docker compose up -d postgres redis

# 3. Install dependencies
bun install

# 4. Prepare database
bun cli db:migrate
bun cli db:partitions
bun cli sde:download
bun cli sde:refresh-mv
```

Then run each in a separate terminal:

```bash
bun dev                    # Nitro dev server
bun ws                     # WebSocket server
bun queue                  # Queue workers (all)
bun cronjobs               # Cron jobs
bun cli listeners:redisq   # zKillboard listener (optional)
bun cli listeners:ekws     # EVE-KILL WebSocket listener (optional)
```

Or use `make dev` to run everything in tmux panes.

## Project Structure

```
├── server/
│   ├── routes/      # API and page routes (file-based routing)
│   ├── models/      # Database models (auto-imported)
│   ├── helpers/     # Utility functions (auto-imported)
│   ├── fetchers/    # ESI API fetchers (auto-imported)
│   ├── plugins/     # Nitro plugins (auto-loaded)
│   ├── middleware/  # HTTP middleware
│   └── utils/       # Utility functions
├── queue/           # BullMQ job processors (auto-discovered)
├── cronjobs/        # Scheduled tasks (auto-discovered)
├── commands/        # CLI commands (auto-discovered)
├── ws/              # WebSocket handlers
├── templates/       # Handlebars templates
│   └── default/     # Default theme
│       ├── components/
│       ├── layouts/
│       ├── pages/
│       ├── partials/
│       └── public/  # Static assets (CSS, JS)
├── db/              # SQL migrations
├── docs/            # Documentation
└── tests/           # Test files
```

## Useful Commands

| Command              | Description                      |
| -------------------- | -------------------------------- |
| `bun dev`            | Start dev server with hot reload |
| `bun test`           | Run tests                        |
| `bun run type-check` | TypeScript type checking         |
| `bun cli --help`     | List all CLI commands            |

## Next Steps

- Read the [Architecture](../reference/architecture.md) guide to understand the system
- Check [Adding Features](./adding-features.md) to start contributing
- Review [Code Style](../reference/code-style.md) for conventions
