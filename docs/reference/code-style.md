# Code Style

Conventions and patterns used in the EVE-KILL codebase.

## TypeScript

### Strict Mode

TypeScript strict mode is enabled. Always type your code:

```typescript
// ✅ Good
async function getCharacter(id: number): Promise<Character | null> {
  return database.queryOne<Character>(
    'SELECT * FROM characters WHERE id = :id',
    { id }
  );
}

// ❌ Bad
async function getCharacter(id) {
  return database.findOne('SELECT * FROM characters WHERE id = :id', { id });
}
```

### Avoid `any`

Use proper types instead of `any`:

```typescript
// ✅ Good
interface KillmailData {
  killmailId: number;
  victim: Victim;
  attackers: Attacker[];
}

// ❌ Bad
function processKillmail(data: any) { ... }
```

### Use `async/await`

Prefer async/await over raw promises:

```typescript
// ✅ Good
const character = await getCharacter(id);
const corporation = await getCorporation(character.corporationId);

// ❌ Bad
getCharacter(id).then(character => {
  getCorporation(character.corporationId).then(corporation => { ... });
});
```

## Naming Conventions

| Type             | Convention  | Example            |
| ---------------- | ----------- | ------------------ |
| Files            | kebab-case  | `solar-systems.ts` |
| Functions        | camelCase   | `getSolarSystem()` |
| Interfaces       | PascalCase  | `ESIKillmail`      |
| Constants        | UPPER_SNAKE | `MAX_RETRIES`      |
| Database columns | camelCase   | `killmailId`       |

## Database

### Use DatabaseHelper

Always use the `database` helper instead of raw SQL:

```typescript
import { database } from '../helpers/database';

// ✅ Good - Uses named parameters
const results = await database.query<Character>(
  'SELECT * FROM characters WHERE "corporationId" = :corpId',
  { corpId: 123 }
);

// ❌ Bad - String interpolation (SQL injection risk)
const results = await database.query(
  `SELECT * FROM characters WHERE "corporationId" = ${corpId}`
);
```

### Quote Column Names

PostgreSQL column names are case-sensitive. Always quote camelCase columns:

```typescript
// ✅ Good
'SELECT "killmailId", "victimCharacterId" FROM killmails';

// ❌ Bad - Will fail or return wrong results
'SELECT killmailId, victimCharacterId FROM killmails';
```

### Bulk Operations

Use bulk methods for multiple records:

```typescript
// ✅ Good - Single query
await database.bulkUpsert('characters', characters, ['id']);

// ❌ Bad - N queries
for (const char of characters) {
  await database.insert('characters', char);
}
```

## Error Handling

### Use `createError` for HTTP Errors

```typescript
import { createError } from 'h3';

if (!killmail) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Killmail not found',
  });
}
```

### Use Logger for Logging

```typescript
import { logger } from '../helpers/logger';

logger.info('Processing killmail', { killmailId });
logger.warn('Rate limited', { endpoint });
logger.error('Failed to fetch', { error: err.message });
logger.success('Completed import', { count: 1000 });
```

## Queue Jobs

### Use Type-Safe Enqueuing

```typescript
import { enqueueJob, QueueType } from '../helpers/queue';

// ✅ Good - Type-checked
await enqueueJob(QueueType.CHARACTER, { id: 123 });

// ❌ Bad - No type safety
await queue.add('character', { id: 123 });
```

### Set Priorities

```typescript
import { JobPriority } from '../helpers/queue';

// Real-time: high priority
await enqueueJob(QueueType.KILLMAIL, data, { priority: JobPriority.HIGH });

// Backfill: low priority
await enqueueJob(QueueType.KILLMAIL, data, { priority: JobPriority.LOW });
```

## Templates (Handlebars)

### Use Partials

Break up templates into reusable partials:

```handlebars
{{!-- ✅ Good --}}
{{> components/page-header title=pageHeader.title breadcrumbs=pageHeader.breadcrumbs }}
{{> partials/killmail-list killmails=killmails }}

{{!-- ❌ Bad - Inline everything --}}
<header>... 50 lines ...</header>
<div>... 100 lines ...</div>
```

### Pass Data Explicitly

```handlebars
{{!-- ✅ Good - Clear data flow --}}
{{> partials/entity-card entity=character type="character" }}

{{!-- ❌ Bad - Relies on implicit context --}}
{{> partials/entity-card }}
```

## Performance

### Track Database Queries

Use the `track` helper for performance monitoring:

```typescript
import { track } from '../utils/performance-decorators';

const [kills, stats] = await track('character:data', 'database', async () => {
  return Promise.all([getKills(characterId), getStats(characterId)]);
});
```

### Parallel Queries

Fetch independent data in parallel:

```typescript
// ✅ Good - Parallel
const [character, kills, stats] = await Promise.all([
  getCharacter(id),
  getKills(id),
  getStats(id),
]);

// ❌ Bad - Sequential
const character = await getCharacter(id);
const kills = await getKills(id);
const stats = await getStats(id);
```
