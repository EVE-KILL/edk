# Adding Features

This guide covers how to add new functionality to EVE-KILL.

## Adding a Route

Routes live in `server/routes/` and follow Nitro's file-based routing.

### Page Route

Create `server/routes/example.get.ts`:

```typescript
import type { H3Event } from 'h3';
import { render } from '../helpers/templates';

export default defineEventHandler(async (event: H3Event) => {
  const pageContext = {
    title: 'Example Page',
    description: 'An example page',
  };

  const data = {
    pageHeader: {
      title: 'Example',
      breadcrumbs: [
        { label: 'Home', url: '/' },
        { label: 'Example', url: '/example' },
      ],
    },
    // Your data here
  };

  return render('pages/example.hbs', pageContext, data, event);
});
```

Create template at `templates/default/pages/example.hbs`:

```handlebars
{{> components/page-header
  title=pageHeader.title
  breadcrumbs=pageHeader.breadcrumbs
}}

<div class="content">
  <!-- Your content -->
</div>
```

### API Route

Create `server/routes/api/example.get.ts`:

```typescript
import type { H3Event } from 'h3';
import { getQuery, createError } from 'h3';

export default defineEventHandler(async (event: H3Event) => {
  const query = getQuery(event);

  // Validate input
  if (!query.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing id parameter',
    });
  }

  // Fetch data
  const data = await getExample(Number(query.id));

  if (!data) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found',
    });
  }

  return data;
});
```

## Adding a Model

Models live in `server/models/` and are auto-imported.

Create `server/models/examples.ts`:

```typescript
import { database } from '../helpers/database';

export interface Example {
  id: number;
  name: string;
  createdAt: string;
}

export async function getExample(id: number): Promise<Example | null> {
  return database.queryOne<Example>('SELECT * FROM examples WHERE id = :id', {
    id,
  });
}

export async function getExamples(limit = 50): Promise<Example[]> {
  return database.query<Example>(
    'SELECT * FROM examples ORDER BY "createdAt" DESC LIMIT :limit',
    { limit }
  );
}

export async function storeExample(data: Omit<Example, 'id'>): Promise<void> {
  await database.bulkUpsert('examples', [data], ['name']);
}
```

Add migration in `db/XX-create-examples-table.sql`:

```sql
CREATE TABLE IF NOT EXISTS examples (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_examples_created ON examples ("createdAt");
```

## Adding a Queue

Queue processors live in `queue/` and are auto-discovered.

Create `queue/example.ts`:

```typescript
import { Job } from 'bullmq';
import { logger } from '../server/helpers/logger';

export const name = 'example';

export async function processor(job: Job<{ id: number }>) {
  const { id } = job.data;

  logger.info(`Processing example job`, { id });

  // Do work here
  await processExample(id);

  logger.success(`Completed example job`, { id });
}

// Optional: customize worker options
export function createWorker(processor: any) {
  return new Worker(name, processor, {
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  });
}
```

Add to queue types in `server/helpers/queue.ts`:

```typescript
export enum QueueType {
  // ... existing
  EXAMPLE = 'example',
}

export interface QueueJobData {
  // ... existing
  [QueueType.EXAMPLE]: { id: number };
}
```

Enqueue jobs:

```typescript
import { enqueueJob, QueueType } from '../helpers/queue';

await enqueueJob(QueueType.EXAMPLE, { id: 123 });
```

## Adding a Cron Job

Cron jobs live in `cronjobs/` and are auto-discovered.

Create `cronjobs/example-task.ts`:

```typescript
import { logger } from '../server/helpers/logger';

export const schedule = '0 * * * *'; // Every hour
export const name = 'example-task';

export async function handler() {
  logger.info('Running example task');

  // Do scheduled work
  await performMaintenance();

  logger.success('Example task complete');
}
```

## Adding a CLI Command

CLI commands live in `commands/` and are auto-discovered.

Create `commands/example.ts`:

```typescript
import { logger } from '../server/helpers/logger';

export default {
  description: 'An example CLI command',
  options: [
    {
      flags: '--dry-run',
      description: 'Run without making changes',
    },
    {
      flags: '--limit <number>',
      description: 'Limit number of items',
      defaultValue: '100',
    },
  ],
  action: async (options: { dryRun?: boolean; limit?: string }) => {
    const limit = parseInt(options.limit || '100', 10);

    logger.info('Running example command', { dryRun: options.dryRun, limit });

    // Do work

    logger.success('Done!');
  },
};
```

Run with:

```bash
bun cli example --dry-run --limit 50
```

## Testing

Add tests in `tests/`:

```typescript
import { describe, it, expect, beforeAll } from 'bun:test';
import { getExample, storeExample } from '../server/models/examples';

describe('Examples Model', () => {
  beforeAll(async () => {
    // Setup test data
  });

  it('should store and retrieve an example', async () => {
    await storeExample({ name: 'Test', createdAt: new Date().toISOString() });

    const result = await getExample(1);

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Test');
  });
});
```

Run with:

```bash
bun test
```
