# Cronjob System

Simple, lightweight cronjob scheduler that runs alongside the webserver. Perfect for recurring tasks like cache cleanup, data maintenance, etc.

## Overview

- **Location**: `/app/cronjobs/` for task implementations, `/src/scheduler/` for infrastructure
- **Base Class**: `BaseCronjob` - Extend this to create new cronjobs
- **Schedule Format**: Standard 5-field cron expressions
- **Execution**: Runs in the same process as the webserver, checked every 60 seconds
- **No Database Tracking**: Simple, lightweight - no persistence layer needed

## Creating a Cronjob

Create a file in `/app/cronjobs/` that extends `BaseCronjob`:

```typescript
import { BaseCronjob, type CronjobResult } from "../../src/scheduler/base-cronjob";

export default class MyCronjob extends BaseCronjob {
  metadata = {
    name: "my-task",
    description: "Do something useful",
    schedule: "0 0 * * *",     // Daily at midnight
    timeout: 120000,             // Max 2 minutes (optional, default 5min)
  };

  async execute(): Promise<CronjobResult> {
    try {
      this.info("Starting...");

      // Your code here
      await doWork();

      this.info("Done!");
      return {
        success: true,
        message: "Task completed successfully",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.error(`Failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }
}
```

## Cron Schedule Format

Standard 5-field cron format: `minute hour day month weekday`

| Field | Range | Examples |
|-------|-------|----------|
| minute | 0-59 | `0`, `*/5`, `0,30` |
| hour | 0-23 | `0`, `*/6`, `2` |
| day | 1-31 | `1`, `15`, `*` |
| month | 1-12 | `1`, `*/3`, `6-9` |
| weekday | 0-6 (0=Sun) | `0`, `1-5`, `6` |

### Examples

```
0 0 * * *       # Daily at midnight
*/5 * * * *     # Every 5 minutes
0 */6 * * *     # Every 6 hours
0 2 * * *       # Daily at 2 AM
0 0 1 * *       # First day of month at midnight
30 14 * * 1     # Every Monday at 2:30 PM
0 9 * * 1-5     # Weekdays at 9 AM
0 0 * 1 *       # January 1st at midnight
```

## Logger Helpers

The `BaseCronjob` class provides logging helpers with automatic task name prefixing:

```typescript
this.info("Message");   // [my-task] Message
this.error("Failed!");  // [my-task] Failed!
this.warn("Caution");   // [my-task] Caution
```

## Configuration

Enable/disable cronjobs via environment variable:

```bash
# .env
CRONJOBS_ENABLED=true   # Default: enabled
```

## Lifecycle

1. **Server starts**: Cronjob scheduler is initialized
2. **Discovery**: All `.ts` files in `/app/cronjobs/` are discovered and loaded
3. **Polling**: Every 60 seconds, scheduler checks if any cronjobs match current time
4. **Execution**: Matching cronjobs are executed
5. **Timeout**: Tasks that exceed their `timeout` value are terminated
6. **Result**: Success/failure is logged to console

## Error Handling

If a cronjob throws an error:

```typescript
// Return error result
return {
  success: false,
  error: "Database connection failed",
};

// Or throw (will be caught and logged)
throw new Error("Something went wrong");
```

Errors are caught and logged, but don't crash the server or other cronjobs.

## Example: Database Cleanup

```typescript
import { BaseCronjob, type CronjobResult } from "../../src/scheduler/base-cronjob";
import { db } from "../../src/db";
import { jobs } from "../../db/schema";

export default class CleanupOldJobs extends BaseCronjob {
  metadata = {
    name: "cleanup-old-jobs",
    description: "Delete jobs older than 30 days",
    schedule: "0 2 * * *",  // 2 AM daily
    timeout: 300000,         // 5 minutes
  };

  async execute(): Promise<CronjobResult> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const deleted = await db
        .delete(jobs)
        .where(lt(jobs.createdAt, thirtyDaysAgo))
        .run();

      return {
        success: true,
        message: `Deleted ${deleted.changes} old jobs`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
```

## Performance Notes

- Checks run every 60 seconds at minute boundaries (efficient)
- Only executes tasks whose schedules match current time
- Each task runs independently (failures don't affect others)
- Timeout prevents runaway tasks from blocking the server
- Logs all execution to console for monitoring

## Startup Output

When the server starts with cronjobs:

```
🕐 Cronjob scheduler started with 2 cronjob(s)
  ├─ cache-cleanup: 0 */6 * * *
  ├─ cleanup-old-jobs: 0 2 * * *
  └─ (running 2 cronjob(s))
```

## Logging Example

During execution:

```
🚀 Running cronjob: cache-cleanup
✅ cache-cleanup completed in 1523ms: Cleaned up 42 cache entries
```

Or on failure:

```
🚀 Running cronjob: my-task
❌ my-task failed: Database connection timeout
```
