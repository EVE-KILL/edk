# Queue Blocking Issue - Root Cause and Fix

## The Problem

Queue workers were not processing jobs truly asynchronously. Jobs appeared to be blocking each other, with some jobs stuck processing for 15+ hours.

## Root Causes

### 1. Blocking Promise.allSettled() Pattern

**What was happening:**

```typescript
// OLD CODE - BLOCKING
private async processQueue(queueName: string, worker: BaseWorker) {
  const promises: Promise<void>[] = [];

  for (let i = 0; i < concurrency; i++) {
    promises.push(this.processNextJob(queueName, worker));
  }

  await Promise.allSettled(promises); // ← BLOCKS HERE!
}
```

**The issue:**
- Queue polls every `pollInterval` (500ms for ESI, 1000ms for killmails)
- Creates N promises based on `concurrency` setting
- **Waits for ALL of them to complete** before returning
- Next poll only happens AFTER all jobs finish
- If one job takes 15 hours, the other concurrent slots wait!

**Example timeline:**
```
Time 0s:   Poll → Start 5 jobs
Time 10s:  Job #1 completes (fast)
Time 20s:  Job #2 completes (fast)
Time 30s:  Job #3 completes (fast)
Time 40s:  Job #4 completes (fast)
Time 15h:  Job #5 FINALLY completes (stuck on slow ESI call)
           ← ONLY NOW does the next poll happen!
           ← 4 worker slots sat idle for 15 hours!
```

### 2. SQLite Write Lock Contention

**What was happening:**
- All 85 concurrent workers share ONE SQLite connection
- SQLite allows only ONE writer at a time (even with WAL mode)
- Every job needs to write 2-3 times:
  1. Claim job (UPDATE jobs SET status='processing')
  2. Complete job (UPDATE jobs SET status='completed')
  3. Enqueue new jobs (INSERT INTO jobs)
- 85 workers competing for the same lock = severe contention

**Example:**
```
Worker 1: tries to complete job → WAITS for lock
Worker 2: tries to claim job → WAITS for lock
Worker 3: tries to enqueue jobs → WAITS for lock
Worker 4: HAS LOCK, writing... (others wait)
Worker 5-85: All BLOCKED waiting
```

## The Fix

### Fix #1: Fire-and-Forget Job Processing

**NEW CODE - Non-blocking:**

```typescript
private async processQueue(queueName: string, worker: BaseWorker) {
  // Count active jobs for this specific queue
  const activeCount = this.getActiveJobCount(queueName);
  const concurrency = worker.concurrency || 1;
  const slotsAvailable = concurrency - activeCount;

  if (slotsAvailable <= 0) {
    return; // All slots full, wait for next poll
  }

  // Fire and forget - don't await!
  for (let i = 0; i < slotsAvailable; i++) {
    this.processNextJob(queueName, worker).catch((error) => {
      logger.error(`[${queueName}] Unhandled error:`, error);
    });
  }
}
```

**How it works:**
1. Check how many jobs are currently active for this queue
2. Calculate available slots (concurrency - active)
3. Start new jobs to fill available slots
4. **DON'T WAIT** for them to finish
5. Next poll happens on schedule, regardless of job duration
6. Track active jobs per queue to respect concurrency limits

**New timeline:**
```
Time 0s:   Poll #1 → Start 5 jobs (fire and forget)
Time 1s:   Poll #2 → All 5 slots full, skip
Time 2s:   Poll #3 → All 5 slots full, skip
Time 10s:  Job #1 completes → 4 slots active
Time 11s:  Poll #11 → Start 1 new job (fill empty slot)
Time 20s:  Job #2 completes → 4 slots active
Time 21s:  Poll #21 → Start 1 new job (fill empty slot)
...
Time 15h:  Job #5 FINALLY completes
           But other jobs have been processing all along!
```

### Fix #2: SQLite Optimization

**Added SQLite PRAGMAs:**

```typescript
// Wait up to 5 seconds for locks instead of failing immediately
rawSqlite.run("PRAGMA busy_timeout = 5000;");

// Faster writes (still safe with WAL mode)
rawSqlite.run("PRAGMA synchronous = NORMAL;");

// Larger cache for better performance
rawSqlite.run("PRAGMA cache_size = -64000;"); // 64MB

// Store temp tables in memory
rawSqlite.run("PRAGMA temp_store = MEMORY;");
```

**What this does:**
- `busy_timeout`: Workers wait up to 5s for lock instead of failing
- `synchronous = NORMAL`: Reduces fsync calls (safe with WAL)
- Larger cache: More data in memory = fewer disk reads
- Temp tables in memory: Faster query execution

### Fix #3: Per-Queue Job Tracking

**NEW: Track active jobs per queue:**

```typescript
private activeJobsByQueue = new Map<string, Set<number>>();

private trackActiveJob(queueName: string, jobId: number): void {
  if (!this.activeJobsByQueue.has(queueName)) {
    this.activeJobsByQueue.set(queueName, new Set());
  }
  this.activeJobsByQueue.get(queueName)!.add(jobId);
  this.activeJobs++;
}

private untrackActiveJob(queueName: string, jobId: number): void {
  const activeSet = this.activeJobsByQueue.get(queueName);
  if (activeSet) {
    activeSet.delete(jobId);
  }
  this.activeJobs--;
}
```

**Why this matters:**
- Know exactly how many jobs are active per queue
- Respect concurrency limits without blocking
- Can make smarter scheduling decisions

## Expected Improvements

### Before Fix
- **Concurrency**: Blocked until ALL jobs complete
- **Throughput**: ~4-5 jobs/sec (limited by blocking)
- **Stuck jobs**: 15+ hours processing
- **Worker utilization**: Very low (slots idle waiting)
- **Database contention**: High (immediate failures on lock)

### After Fix
- **Concurrency**: True parallel processing
- **Throughput**: Should jump to 50-100+ jobs/sec
- **Stuck jobs**: Won't block other jobs
- **Worker utilization**: High (all slots actively working)
- **Database contention**: Reduced (5s wait for locks)

## Monitoring

### Check if fix is working:

```bash
# Run queue status to see rates
bun cli queue:status

# Should see:
# - Higher "Rate/min" values (was 0, should be 50+)
# - Processing count stays near concurrency limits
# - Pending count decreases steadily
```

### Watch for issues:

```bash
# Run with debug logging
LOG_LEVEL=debug bun cli queue:work

# Look for:
# - Rapid job completions (not long pauses)
# - No "database locked" errors
# - Jobs completing in seconds, not hours
```

## Remaining Concerns

### Stuck Jobs

Jobs processing for 15+ hours are likely:
1. Waiting on slow/hung HTTP requests (ESI timeouts?)
2. Stuck in infinite loops (unlikely)
3. Database locked (should be fixed now)

**Next steps:**
- Add request timeouts to all HTTP calls
- Add job processing timeout (kill job after N minutes)
- Monitor which jobs get stuck (character/corp/alliance?)

### Database Lock Contention

If you still see "database locked" errors:
- Consider reducing concurrency per worker
- Add retry logic with exponential backoff
- Consider splitting into multiple SQLite databases

### ESI Rate Limiting

With higher throughput:
- ESI might rate-limit you
- EVE-KILL might rate-limit you
- Monitor error rates in queue:status

## Configuration Tuning

### If throughput is too high:

Reduce concurrency in workers:

```typescript
// app/queue/esi-fetcher.ts
override concurrency = 5; // Reduce from 10

// app/queue/killmail-fetcher.ts
override concurrency = 3; // Reduce from 5
```

### If getting database locked errors:

Increase busy timeout:

```typescript
// src/db/index.ts
rawSqlite.run("PRAGMA busy_timeout = 10000;"); // 10 seconds
```

### If memory usage too high:

Reduce cache size:

```typescript
rawSqlite.run("PRAGMA cache_size = -32000;"); // 32MB instead of 64MB
```

## Testing the Fix

1. **Restart workers:**
   ```bash
   # Kill existing workers
   pkill -f "queue:work"

   # Start fresh
   bun cli queue:work
   ```

2. **Monitor status:**
   ```bash
   # In another terminal
   bun cli queue:status
   ```

3. **Expected results:**
   - "Rate/min" should jump from 0 to 50+
   - Processing count should stay near concurrency limits
   - No jobs stuck for hours
   - Pending count decreases steadily

4. **Check logs:**
   ```bash
   LOG_LEVEL=debug bun cli queue:work 2>&1 | tee worker.log
   ```

   Look for rapid job completions:
   ```
   [killmail-fetch] ✅ Job #123 completed
   [killmail-fetch] ✅ Job #124 completed
   [killmail-fetch] ✅ Job #125 completed
   [esi] ✅ Job #456 completed
   [esi] ✅ Job #457 completed
   ```

## Summary

**Root cause:** Queue workers were using `Promise.allSettled()` which blocked until ALL concurrent jobs finished, causing severe underutilization and making slow jobs block fast ones.

**Fix:** Changed to fire-and-forget pattern with per-queue job tracking, allowing true parallel processing without blocking.

**Bonus:** Added SQLite optimizations to reduce lock contention from concurrent workers.

**Expected result:** Throughput should increase 10-20x, from ~4 jobs/sec to 50-100+ jobs/sec.
