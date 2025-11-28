# EVE-KILL Documentation

Welcome to the EVE-KILL documentation. This guide covers everything you need to know about running, developing, and understanding the EVE-KILL killboard.

## Quick Start

New to EVE-KILL development? Start here:

1. [Getting Started](./guides/getting-started.md) - Set up your development environment
2. [Architecture Overview](./reference/architecture.md) - Understand the system design
3. [Adding Features](./guides/adding-features.md) - Learn how to extend the system

## What is EVE-KILL?

EVE-KILL is a high-performance, self-hosted killboard for EVE Online. It tracks player kills and losses in real-time, providing detailed statistics and analytics.

### Key Features

- **Real-time Updates** - Killmails appear instantly via WebSocket streams
- **Fast Search** - PostgreSQL pg_trgm-powered search across millions of records
- **Self-Hosted** - Run your own instance with full control
- **Modern Stack** - Built with Bun, Nitro, PostgreSQL, and Redis
- **Scalable** - Handles millions of killmails with partitioned tables

## Technology Stack

| Component   | Technology     | Purpose                                |
| ----------- | -------------- | -------------------------------------- |
| Runtime     | Bun            | Fast JavaScript runtime                |
| Framework   | Nitro          | Web server and SSR                     |
| Database    | PostgreSQL 14+ | Primary data store with pg_trgm search |
| Cache/Queue | Redis + BullMQ | Caching and job processing             |
| Templates   | Handlebars     | Server-side rendering                  |

---

## Documentation Sections

### 📚 Systems

Deep dives into the major systems and how they work:

- **[Killmail Processing](./systems/killmail-processing.md)** - How killmails are ingested, processed, and stored
- **[Entity Tracking](./systems/entity-tracking.md)** - Character, corporation, and alliance data management
- **[Queue System](./systems/queue-system.md)** - Asynchronous job processing with BullMQ
- **[Search](./systems/search.md)** - Full-text search using PostgreSQL pg_trgm
- **[Database](./systems/database.md)** - PostgreSQL schema, partitioning, and performance

### 🛠️ Developer Guides

Step-by-step guides for developers:

- **[Getting Started](./guides/getting-started.md)** - Development environment setup
- **[Adding Features](./guides/adding-features.md)** - Routes, models, queues, and templates
- **[Testing](./guides/testing.md)** - Running and writing tests

### 📖 Reference

Reference material and specifications:

- **[Architecture](./reference/architecture.md)** - High-level system design and data flow
- **[Configuration](./reference/configuration.md)** - Environment variables and settings
- **[Code Style](./reference/code-style.md)** - Conventions and patterns
- **[WebSocket](./reference/websocket.md)** - Real-time API specification

---

## Common Tasks

### Setting Up Locally

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Bootstrap everything (Docker, migrations, SDE import)
make setup

# 3. Start development stack in tmux
make dev
```

### Running the Application

```bash
# Start web server
bun dev

# Start WebSocket listener
bun cli listeners:ekws

# Start queue workers
bun queue

# Start cron jobs
bun cronjobs
```

### Working with the Database

```bash
# Run migrations
bun cli db:migrate

# Create partitions
bun cli db:partitions

# Refresh materialized views
bun cli db:refresh
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/database.test.ts

# Run with coverage
bun test --coverage
```

---

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP / WebSocket
┌─────────────────────────▼───────────────────────────────────────┐
│                    Nitro Web Server                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ HTML Routes  │  │  API Routes  │  │  WebSocket Server    │   │
│  │ (Handlebars) │  │  (JSON)      │  │  (Real-time feed)    │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    Background Services                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Queue Workers│  │  Cron Jobs   │  │  Killmail Listeners  │   │
│  │ (BullMQ)     │  │  (Scheduled) │  │  (RedisQ, WebSocket) │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                      Data Stores                                 │
│  ┌──────────────────────────────────┐  ┌──────────────────────┐ │
│  │        PostgreSQL                │  │        Redis         │ │
│  │  (Primary DB + Search pg_trgm)   │  │    (Cache/Queue)     │ │
│  └──────────────────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Killmail Flow

1. **Ingestion** - Killmails arrive from RedisQ or WebSocket listeners
2. **Queue** - Jobs are enqueued in BullMQ with priority
3. **Processing** - Workers fetch ESI data, calculate values, extract entities
4. **Storage** - Data is stored in partitioned PostgreSQL tables
5. **Broadcast** - WebSocket broadcasts new killmails to connected clients
6. **Entity Updates** - Character/corp/alliance data updated in background

### Entity Management

- Entities (characters, corps, alliances) are cached for 7 days
- ESI API is queried when data is stale or missing
- Background queue workers update entity data
- NPC entities are handled specially (from SDE, not ESI)

### Queue Priorities

- **HIGH (1)**: Real-time killmails from live streams
- **NORMAL (5)**: Manual operations and regular tasks
- **LOW (10)**: Entity updates, backfills, batch operations

### Database Partitioning

- Killmails table is partitioned by month
- Automatic partition creation via cron job
- Queries should include time range for partition pruning
- Each partition has its own indexes

---

## Getting Help

### Troubleshooting

- Check the system documentation for your specific issue
- Review logs: `docker compose logs` or application console output
- Test database connection: `bun cli db:test`
- Check queue status: `bun cli queue:stats`

### Development

- Browse the codebase starting from `server/routes/` for request handling
- Check `server/models/` for database queries
- Review `queue/` for background job processors
- Look at `commands/` for CLI tools

### Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on:

- Code style and conventions
- Testing requirements
- Pull request process
- Commit message format

---

## External Resources

- **EVE ESI API**: https://esi.evetech.net/ui/
- **EVE SDE**: https://developers.eveonline.com/resource/resources
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **postgres.js**: https://github.com/porsager/postgres
- **Nitro**: https://nitro.build/
- **BullMQ**: https://docs.bullmq.io/
- **Bun**: https://bun.sh/docs
- **Handlebars**: https://handlebarsjs.com/

---

**Last Updated**: November 2025 | **Version**: 0.2.0-alpha
