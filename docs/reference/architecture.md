# Architecture

EVE-KILL is designed as a high-performance, modular system for tracking EVE Online killmails.

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
│  │ Queue Workers│  │  Cron Jobs   │  │  RedisQ Listener     │   │
│  │ (BullMQ)     │  │  (Scheduled) │  │  (Killmail ingestion)│   │
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

## Core Components

### Web Server (Nitro)

The Nitro server handles all HTTP requests:

- **HTML Routes** - Server-side rendered pages using Handlebars
- **API Routes** - JSON endpoints for data access
- **WebSocket** - Real-time killmail streaming

### Background Services

Asynchronous processing happens via:

- **Queue Workers** - Process killmails, update entities (BullMQ)
- **Cron Jobs** - Scheduled maintenance tasks
- **RedisQ Listener** - Ingests killmails from zKillboard

### Data Stores

- **PostgreSQL** - All persistent data (killmails, entities, wars) with full-text search using `pg_trgm` extension
- **Redis** - Caching and job queue backend

## Killmail Data Flow

```text
1. RedisQ Listener polls zKillboard
                ↓
2. New killmail enqueued to BullMQ
                ↓
3. Queue worker processes:
   - Fetches ESI data (character, corp, alliance)
   - Calculates total value
   - Stores in PostgreSQL
                ↓
4. WebSocket broadcasts to connected clients
```

## Database Schema

### Killmails (Partitioned)

The `killmails` table is partitioned by month for performance:

- `killmails_2024_01`, `killmails_2024_02`, etc.
- Automatic partition creation via cron job
- Indexes on commonly queried fields

### Entities

- `characters` - Player characters
- `corporations` - Player corporations
- `alliances` - Player alliances
- `wars` - War declarations

### Static Data (SDE)

EVE's Static Data Export is imported into:

- `types`, `groups`, `categories` - Item data
- `solarsystems`, `regions`, `constellations` - Map data
- `factions` - NPC factions

## Key Design Decisions

### Why PostgreSQL?

- Complex queries with JOINs
- Partitioning for large datasets
- Strong consistency guarantees

### Why BullMQ?

- Reliable job processing with retries
- Priority queues for real-time vs backfill
- Redis-based, so no extra infrastructure

### Why PostgreSQL for Search?

- Uses `pg_trgm` extension for trigram-based similarity search
- No additional infrastructure needed
- Supports full-text search on entity names (characters, corps, alliances)
- Simple GIN indexes for fast lookups

### Why Handlebars?

- Server-side rendering for SEO
- Fast initial page loads
- Simple templating syntax
