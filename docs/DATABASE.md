# Database Layer Documentation

## Overview

EVE Kill v4 uses **Drizzle ORM** with **SQLite** (via Bun's native driver) for data persistence. The architecture is designed to be:

- **Type-safe** - Full TypeScript inference on all queries
- **Performant** - Uses Bun's native SQLite driver (faster than better-sqlite3)
- **Portable** - Easy to switch to PostgreSQL/MySQL when needed
- **Developer-friendly** - Clean model layer with repository pattern

## Architecture

```
app/
  db/
    schema/           # Table schemas (TypeScript)
      killmails.ts    # Killmail table definition
      index.ts        # Schema exports
    migrations/       # Auto-generated SQL migrations
    index.ts          # Database connection singleton
    migrate.ts        # Migration runner script
    seed.ts           # Sample data seeder
  models/             # Data access layer
    base-model.ts     # Base CRUD operations
    killmail.ts       # Killmail-specific methods
    index.ts          # Model exports
```

## Database Connection

The database connection is a **singleton** that:
- Creates the database file if it doesn't exist
- Enables WAL mode for better concurrency
- Enables foreign key constraints
- Logs queries in development mode

```typescript
import { db } from "./app/db";

// db is ready to use anywhere
const killmails = await db.select().from(killmailsTable);
```

## Schemas

Schemas are defined using Drizzle's type-safe schema builder:

```typescript
// app/db/schema/killmails.ts
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const killmails = sqliteTable("killmails", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  killmailId: integer("killmail_id").notNull().unique(),
  hash: text("hash").notNull(),
  // ... more columns
});

// Auto-generated types
export type Killmail = typeof killmails.$inferSelect;
export type NewKillmail = typeof killmails.$inferInsert;
```

### Current Tables

#### Killmails Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `killmailId` | INTEGER | CCP/zkill killmail ID (unique) |
| `hash` | TEXT | Killmail verification hash |
| `killmailTime` | TIMESTAMP | When the kill occurred |
| `solarSystemId` | INTEGER | Solar system where kill happened |
| `victim` | JSON | Victim data (character, corp, ship) |
| `attackers` | JSON | Array of attacker data |
| `items` | JSON | Fitted items on the ship |
| `totalValue` | INTEGER | ISK value of the kill |
| `attackerCount` | INTEGER | Number of attackers |
| `points` | INTEGER | Killboard points |
| `isSolo` | BOOLEAN | Solo kill flag |
| `isNpc` | BOOLEAN | NPC kill flag |
| `createdAt` | TIMESTAMP | Record creation time |
| `updatedAt` | TIMESTAMP | Last update time |

**Indexes:**
- `killmail_id_idx` - Fast lookup by killmail ID
- `hash_idx` - Fast lookup by hash
- `killmail_time_idx` - Chronological ordering
- `solar_system_id_idx` - System-based queries
- `total_value_idx` - Value-based queries

## Models

Models provide a clean API for database operations using the repository pattern.

### Base Model

All models extend `BaseModel` which provides common CRUD operations:

```typescript
class BaseModel<TTable, TSelect, TInsert> {
  // Read operations
  findById(id: number): Promise<TSelect | null>
  findOne(where: SQL): Promise<TSelect | null>
  find(options): Promise<TSelect[]>
  findAll(limit?): Promise<TSelect[]>

  // Write operations
  create(data: TInsert): Promise<TSelect>
  createMany(data: TInsert[]): Promise<TSelect[]>
  update(id, data): Promise<TSelect | null>
  updateWhere(where, data): Promise<number>

  // Delete operations
  delete(id: number): Promise<boolean>
  deleteWhere(where: SQL): Promise<number>

  // Utility operations
  count(where?): Promise<number>
  exists(where: SQL): Promise<boolean>
  paginate(options): Promise<PaginatedResult>
}
```

### Killmail Model

The `KillmailModel` adds killmail-specific methods:

```typescript
// Find by killmail ID (from CCP)
await Killmails.findByKillmailId(123456);

// Find by hash
await Killmails.findByHash("abc123...");

// Get recent killmails
await Killmails.getRecent(50);

// Get by solar system
await Killmails.getBySolarSystem(30000142, 50);

// Get high value kills (> 100M ISK)
await Killmails.getHighValue(100000000, 50);

// Get solo kills
await Killmails.getSolo(50);

// Get by time range
await Killmails.getByTimeRange(startDate, endDate);

// Search by character/corp/alliance ID
await Killmails.searchByEntity(12345, 50);

// Get statistics
const stats = await Killmails.getStats(startDate, endDate);
// Returns: { total, totalValue, soloKills, npcKills, avgValue, avgAttackers }

// Bulk operations
await Killmails.bulkInsert(killmailsArray);
await Killmails.deleteOlderThan(cutoffDate);

// Pagination
const result = await Killmails.paginate({ page: 1, perPage: 50 });
// Returns: { data, total, page, perPage, totalPages }
```

## Usage in Controllers

Models and database are available in all controllers:

```typescript
export class Controller extends BaseController {
  async handle(): Promise<Response> {
    // Option 1: Use models (recommended)
    const killmail = await this.models.Killmails.findById(123);

    // Option 2: Use Drizzle directly
    const killmails = await this.db
      .select()
      .from(schema.killmails)
      .limit(10);

    return this.json({ killmail });
  }
}
```

## Migrations

Migrations are auto-generated from schema changes:

```bash
# 1. Modify schema in app/db/schema/
# 2. Generate migration
bun run db:generate

# 3. Apply migration
bun run db:migrate
```

### Migration Files

Generated migrations are SQL files in `app/db/migrations/`:

```sql
-- 0000_acoustic_sage.sql
CREATE TABLE `killmails` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `killmail_id` integer NOT NULL,
  ...
);

CREATE UNIQUE INDEX `killmail_id_idx` ON `killmails` (`killmail_id`);
```

## Seeding Data

Seed the database with sample data:

```bash
bun run app/db/seed.ts
```

Seed script (`app/db/seed.ts`) inserts sample killmails and shows statistics.

## npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "bun run app/db/migrate.ts",
    "db:studio": "drizzle-kit studio",
    "db:seed": "bun run app/db/seed.ts"
  }
}
```

## Drizzle Studio

Visual database browser:

```bash
bun run db:studio
```

Opens at `https://local.drizzle.studio` - explore tables, run queries, edit data.

## Query Examples

### Simple Queries

```typescript
// Find one
const km = await Killmails.findById(1);

// Find many
const recent = await Killmails.getRecent(10);

// Count
const total = await Killmails.count();

// Check existence
const exists = await Killmails.existsByKillmailId(100001);
```

### Complex Queries

```typescript
import { eq, and, gte, lte, desc } from "./app/models/base-model";

// Find with conditions
const kills = await Killmails.find({
  where: and(
    gte(killmails.totalValue, 50000000),
    eq(killmails.isSolo, true)
  ),
  limit: 50,
  orderBy: desc(killmails.totalValue)
});

// Pagination
const page1 = await Killmails.paginate({
  page: 1,
  perPage: 50,
  where: gte(killmails.totalValue, 100000000),
  orderBy: desc(killmails.killmailTime)
});
```

### Raw SQL (when needed)

```typescript
// In models
const result = await this.rawQuery<Killmail>(
  "SELECT * FROM killmails WHERE json_extract(victim, '$.characterId') = ?",
  [characterId]
);
```

## Type Safety

Full TypeScript inference:

```typescript
const killmail = await Killmails.findById(1);
// killmail is typed as Killmail | null

if (killmail) {
  killmail.killmailId  // number
  killmail.hash        // string
  killmail.victim      // { characterId?: number, ... }
  killmail.attackers   // Array<{ characterId?: number, ... }>
}

// Insert types
const newKillmail: NewKillmail = {
  killmailId: 100004,
  hash: "...",
  // TypeScript ensures all required fields are present
};
```

## Performance Tips

### 1. Use Indexes

Indexes are defined in the schema for common queries:

```typescript
(table) => ({
  killmailIdIdx: index("killmail_id_idx").on(table.killmailId),
})
```

### 2. Batch Inserts

Use `createMany` or `bulkInsert` for multiple records:

```typescript
// Good - single transaction
await Killmails.bulkInsert(killmailsArray);

// Bad - multiple transactions
for (const km of killmailsArray) {
  await Killmails.create(km);
}
```

### 3. Pagination

Always paginate large result sets:

```typescript
const { data, total, totalPages } = await Killmails.paginate({
  page: 1,
  perPage: 50
});
```

### 4. Select Only What You Need

```typescript
// If you need specific fields
const killmails = await db
  .select({ id: killmails.id, value: killmails.totalValue })
  .from(killmails)
  .limit(100);
```

## Switching to PostgreSQL

When you need to scale:

1. **Install PostgreSQL driver:**
```bash
bun add postgres
```

2. **Update connection:**
```typescript
// app/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);
```

3. **Update config:**
```typescript
// drizzle.config.ts
export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

4. **Regenerate migrations:**
```bash
bun run db:generate
bun run db:migrate
```

**That's it!** Your models and queries work identically - only the connection changes.

## Best Practices

### 1. Keep Schemas Simple

- Use JSON columns for flexible data (victim, attackers, items)
- Add indexes for frequently queried fields
- Use appropriate data types (INTEGER for IDs, TEXT for strings)

### 2. Use Models for Business Logic

```typescript
// Good - in model
class KillmailModel extends BaseModel {
  async getHighValueSoloKills(minValue: number) {
    return this.find({
      where: and(
        gte(killmails.totalValue, minValue),
        eq(killmails.isSolo, true)
      ),
      orderBy: desc(killmails.totalValue)
    });
  }
}

// Bad - in controller
const kills = await db.select()...  // Raw queries in controllers
```

### 3. Handle Nulls Gracefully

```typescript
const killmail = await Killmails.findById(id);

if (!killmail) {
  return this.notFound("Killmail not found");
}

// Now killmail is non-null
```

### 4. Cache Database Queries

```typescript
async get(): Promise<Response> {
  const killmail = await this.cache.remember(
    `killmail:${id}`,
    async () => await this.models.Killmails.findById(id),
    300
  );
}
```

## Troubleshooting

**Database locked:**
- SQLite uses WAL mode - should rarely lock
- Check for long-running transactions
- Consider PostgreSQL for high concurrency

**Migration conflicts:**
- Delete `app/db/migrations/` and regenerate
- Or manually edit SQL migration files

**Type errors:**
- Regenerate types: `bun run db:generate`
- Restart TypeScript server in VS Code

**Performance issues:**
- Add indexes for slow queries
- Use `EXPLAIN QUERY PLAN` to analyze
- Consider pagination for large result sets

## Future Enhancements

- [ ] Add more tables (users, corporations, alliances)
- [ ] Implement relationships (foreign keys)
- [ ] Add full-text search
- [ ] Set up connection pooling for PostgreSQL
- [ ] Add database backups/replication
- [ ] Implement soft deletes
- [ ] Add audit logging
- [ ] Create database health check endpoint

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Bun SQLite](https://bun.sh/docs/api/sqlite)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)
