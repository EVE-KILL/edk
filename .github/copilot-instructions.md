# GitHub Copilot Instructions - EDK

## Project Overview

EDK (ekv4) is a modern killmail tracking application for EVE Online, built with:
- **Runtime**: Bun (high-performance JavaScript/TypeScript runtime)
- **Database**: SQLite via Drizzle ORM
- **Server**: Built-in Bun HTTP server with custom routing
- **Cache**: Dual-layer (LRU + Redis) caching system
- **Queue**: Custom job queue system for background processing
- **Templates**: Handlebars for HTML rendering
- **API**: ESI (EVE Swagger Interface) integration for game data

## Project Structure

The project is split into two main directories:

### `/src` - Server Infrastructure
Server-related code that provides the foundation for the application. These are framework-like components.

- **`/src/server/`** - HTTP server components
  - `router.ts` - Automatic route discovery and request handling with caching
  - `middleware.ts` - Request logging, performance monitoring, rate limiting
  - `error-handler.ts` - Error response generation (HTML/JSON)
  - `templates.ts` - Handlebars template rendering engine

- **`/src/controllers/`** - Base controller classes
  - `base-controller.ts` - Base controller with common methods (db, cache, models access)
  - `api-controller.ts` - JSON API controller (extends BaseController)
  - `web-controller.ts` - HTML page controller (extends BaseController)

- **`/src/cache/`** - Caching infrastructure
  - `adapter.ts` - Cache adapter interface
  - `factory.ts` - Cache factory for creating adapters
  - `cache-key.ts` - Response caching utilities
  - `lru-adapter.ts` - In-memory LRU cache
  - `redis-adapter.ts` - Redis cache adapter
  - `index.ts` - Cache initialization and export

- **`/src/utils/`** - Server utilities
  - `logger.ts` - Logging utility with levels

- **`/src/db/`** - Database infrastructure
  - `index.ts` - Database connection singleton (with query logging)

- **`/src/queue/`** - Queue infrastructure
  - `job-dispatcher.ts` - Job enqueueing and management
  - `base-worker.ts` - Base class for queue workers

- **`/src/commands/`** - CLI infrastructure
  - `base-command.ts` - Base class for CLI commands
  - `types.ts` - Command type definitions

- **`/src/services/`** - Service infrastructure
  - `esi/base-service.ts` - Base class for ESI API services
  - `esi/rate-limiter.ts` - ESI rate limiting and error budget management

### `/app` - Application Code
Application-specific code that implements the business logic and features.

- **`/app/routes/`** - Route handlers
  - Each file exports a controller class that handles specific routes
  - File-based routing: `routes/api/killmails/[id].ts` → `/api/killmails/:id`
  - Controllers extend `ApiController` or `WebController`

- **`/app/models/`** - Data models
  - Active Record pattern models for business logic
  - Example: `Killmail` model with methods like `findById()`, `findRecent()`



- **`/app/services/`** - External service integrations
  - `esi/` - EVE Online ESI API services
    - `*-service.ts` - Specific ESI endpoints (characters, corporations, etc.)

- **`/app/queue/`** - Background job processing
  - `queue-manager.ts` - Job queue coordinator
  - `*-worker.ts` - Specific workers (killmail processing, ESI fetching, etc.)

- **`/app/commands/`** - CLI commands
  - Organized in subdirectories (db/, cache/, esi/, etc.)
  - Run via: `bun cli <command>`

- **`/app/generators/`** - Data generators
  - Generate data structures for responses (killmail, killlist, etc.)

- **`/app/types/`** - TypeScript type definitions
  - `request.d.ts` - Request type extensions
  - `cache.d.ts` - Cache type definitions

### `/db` - Database Artifacts
All database-related files managed by Drizzle ORM:
- `schema/` - TypeScript schema definitions (Drizzle ORM schemas)
- `migrations/` - SQL migration files and metadata
- Schema changes: Edit files in `schema/`, then run `drizzle-kit generate`
- Apply migrations: `bun cli db:migrate`

### `/scripts` - Utility Scripts
Standalone scripts for development and maintenance:
- `migrate.ts` - Migration runner (called by db:migrate command)
- `get-killmail-id.ts` - Development helper script

## Architectural Patterns

### Controllers
Controllers should extend either `ApiController` or `WebController`:

```typescript
// API Controller (JSON responses)
import { ApiController } from "../../../src/controllers/api-controller";

export class Handler extends ApiController {
  static methods = ["GET"];

  async get(): Promise<Response> {
    const data = await this.db.query.items.findMany();
    return this.jsonResponse(data);
  }
}

// Web Controller (HTML responses)
import { WebController } from "../../src/controllers/web-controller";

export class Handler extends WebController {
  static methods = ["GET"];

  async get(): Promise<Response> {
    return this.render("pages/home", { title: "Home" });
  }
}
```

### Models
Models use Active Record pattern and extend `BaseModel`:

```typescript
import { BaseModel } from "./base-model";

export class Killmail extends BaseModel {
  static async findById(id: number) {
    return await db.query.killmails.findFirst({
      where: eq(killmails.id, id)
    });
  }
}
```

### Services
ESI services extend `BaseESIService` (from `/src/services/esi/`) for automatic caching and rate limiting:

```typescript
import { BaseESIService } from "../../../src/services/esi/base-service";

export class CharacterService extends BaseESIService {
  async getCharacter(characterId: number): Promise<Character> {
    return await this.fetchFromESI<ESICharacter>(
      `/characters/${characterId}/`,
      `character:${characterId}`
    );
  }
}
```

### Queue Workers
Workers extend `BaseWorker` (from `/src/queue/`) and implement `handle()`:

```typescript
import { BaseWorker } from "../../src/queue/base-worker";

export class KillmailFetcher extends BaseWorker {
  queueName = "killmails";

  async handle(payload: any, job: Job): Promise<void> {
    const { killmailId, hash } = payload;
    await this.killmailService.fetchKillmail(killmailId, hash);
  }
}
```

## Key Conventions

1. **File-based Routing**: Route files in `/app/routes/` are automatically discovered
   - Dynamic segments: `[id].ts` → `:id` parameter
   - Nested folders create path hierarchy

2. **Controller Methods**: Map to HTTP methods (lowercase)
   - `async get()` - Handle GET requests
   - `async post()` - Handle POST requests
   - etc.

3. **Static Methods Property**: Controllers define supported HTTP methods
   ```typescript
   static methods = ["GET", "POST"];
   ```

4. **Cache Access**: Controllers have direct access to cache via `this.cache`

5. **Database Access**: Controllers have direct access to DB via `this.db`

6. **Models Access**: Controllers have access to models via `this.models`

7. **Logger**: Use `logger` from `src/utils/logger` for consistent logging
   ```typescript
   import { logger } from "../../src/utils/logger";
   logger.info("Processing killmail", killmailId);
   ```

8. **Environment Variables**: Cached at module level for performance
   ```typescript
   const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
   ```

## Database

- **ORM**: Drizzle ORM with SQLite
- **Schema Location**: `/app/db/schema/`
- **Migrations**: Run with `bun cli db:migrate`
- **Type-safe**: Full TypeScript support via Drizzle

## Caching Strategy

1. **Response Caching**: Automatic via router configuration in controllers
2. **ESI Caching**: Automatic in `BaseESIService` with ETags
3. **Manual Caching**: Available via `this.cache` in controllers

## Development

- **Start Server**: `bun index.ts`
- **Run CLI**: `bun cli <command>`
- **Run Migrations**: `bun cli db:migrate`
- **Watch Mode**: Auto-reload on file changes

## Testing

- Tests located in `/tests/`
- Run with Bun's built-in test runner

## ESI Integration

- All ESI services in `/app/services/esi/`
- Automatic rate limiting via `esiRateLimiter`
- Automatic caching with ETag support
- Handles 404s and errors gracefully

## Queue System

- Job-based background processing
- Workers poll database for jobs
- Configurable concurrency and retry logic
- Job types: `killmail:fetch`, `killmail:process`, `esi:fetch`

## Important Notes

- **Never import from old `/app/utils/` path** - Use `/src/` paths instead
- **Bun-specific**: Uses Bun APIs (not Node.js compatible)
- **Type Safety**: Strict TypeScript enabled
- **Performance**: Optimized for high throughput with caching and async processing
