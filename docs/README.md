# Documentation Structure

This folder contains the complete EVE-KILL documentation, organized by topic and purpose.

## Folder Structure

```
docs/
├── index.md              # Main documentation landing page
├── systems/              # System-level documentation
│   ├── killmail-processing.md
│   ├── entity-tracking.md
│   ├── queue-system.md
│   ├── search.md
│   └── database.md
├── guides/               # Developer how-to guides
│   ├── getting-started.md
│   ├── adding-features.md
│   └── testing.md
└── reference/            # Reference material
    ├── architecture.md
    ├── configuration.md
    ├── code-style.md
    └── websocket.md
```

## Systems Documentation

The `systems/` folder contains deep dives into the major systems:

- **killmail-processing.md** - How killmails flow from ingestion to storage
- **entity-tracking.md** - Character, corporation, and alliance management
- **queue-system.md** - BullMQ job processing and patterns
- **search.md** - PostgreSQL pg_trgm full-text search
- **database.md** - Schema, partitioning, indexes, and performance

## Developer Guides

The `guides/` folder contains step-by-step instructions:

- **getting-started.md** - Local development environment setup
- **adding-features.md** - How to add routes, models, queues, templates
- **testing.md** - Writing and running tests

## Reference Material

The `reference/` folder contains specifications and conventions:

- **architecture.md** - High-level system design and data flow
- **configuration.md** - Environment variables and settings
- **code-style.md** - TypeScript conventions and patterns
- **websocket.md** - WebSocket API specification

## Viewing Documentation

### Locally

Start the development server and navigate to `/docs`:

```bash
bun dev
# Open http://localhost:3000/docs
```

### Files

All documentation is in Markdown format and can be viewed in any Markdown reader or on GitHub.

## Contributing to Documentation

When adding new documentation:

1. **Systems** - Add deep technical documentation about how major systems work
2. **Guides** - Add step-by-step tutorials for common development tasks
3. **Reference** - Add specifications, conventions, or API references

Keep documentation:

- Clear and concise
- With code examples where appropriate
- Up-to-date with the codebase
- Organized by topic, not by file/folder structure

## What's Documented

### Systems (Complete Deep Dives)

- ✅ Killmail processing flow from ingestion to storage
- ✅ Entity tracking (characters, corps, alliances) with ESI integration
- ✅ Queue system architecture with BullMQ and priorities
- ✅ PostgreSQL database with partitioning and performance tuning
- ✅ Search system using pg_trgm extension

### Guides (Step-by-Step Tutorials)

- ✅ Local development environment setup
- ✅ Adding routes, models, queues, cron jobs, and CLI commands
- ✅ Writing and running tests with Bun

### Reference (Specifications & Conventions)

- ✅ High-level architecture and data flow
- ✅ Environment variables and configuration
- ✅ TypeScript code style and naming conventions
- ✅ WebSocket API specification

## Navigation

Start with [index.md](./index.md) for the main documentation landing page.
