# Queue Worker Logging

## Overview

The queue workers have two logging modes to balance between visibility and performance:

1. **INFO mode** (default): Summary statistics every 30 seconds
2. **DEBUG mode**: Detailed logs for every job processed

## Logging Modes

### INFO Mode (Default)

Shows summary statistics every 30 seconds with queue status and processing rates.

**Usage:**
```bash
bun cli queue:work
```

**Output Example:**
```
🔄 Starting Queue Workers
══════════════════════════════════════════════════

📋 Configuration:
   Log Level: info
   Output: Summary stats every 30 seconds
   💡 For detailed logs: LOG_LEVEL=debug bun cli queue:work

Press Ctrl+C to stop

🔄 Initializing queue workers...
✅ Queue workers started successfully

💡 Monitoring queues for jobs...

📊 Queue Statistics:
   killmail-fetch: 1,671,011 pending, 65 processing
   esi: 157,905 pending, 5 processing
   price-fetch: 0 pending, 0 processing
   type-fetch: 0 pending, 1 processing
   Rate: 4.23 jobs/sec (127 total in 30s)
   Active: 71 jobs currently processing

📊 Queue Statistics:
   killmail-fetch: 1,670,884 pending, 65 processing
   esi: 157,843 pending, 5 processing
   price-fetch: 0 pending, 0 processing
   type-fetch: 0 pending, 1 processing
   Rate: 4.20 jobs/sec (126 total in 30s)
   Active: 71 jobs currently processing
```

**Pros:**
- Clean, readable output
- Low overhead
- Easy to spot issues
- Good for production

**Cons:**
- Don't see individual job processing
- 30-second delay before seeing activity

### DEBUG Mode

Shows detailed logs for every job being processed.

**Usage:**
```bash
LOG_LEVEL=debug bun cli queue:work
```

**Output Example:**
```
🔄 Starting Queue Workers
══════════════════════════════════════════════════

📋 Configuration:
   Log Level: debug
   Output: Detailed logs for every job

Press Ctrl+C to stop

🔄 Initializing queue workers...
🐛 📝 Registered worker: killmail-fetch (concurrency: 5)
🐛 📝 Registered worker: esi (concurrency: 10)
🐛 📝 Registered worker: price-fetch (concurrency: 3)
🐛 📝 Registered worker: type-fetch (concurrency: 10)
✅ Queue workers started successfully

💡 Monitoring queues for jobs...

🐛 [killmail-fetch] Processing job #123456 (attempt 1/3)
🐛   ↳ Fetched and saved killmail 123456
🐛 [killmail-fetch] ✅ Job #123456 completed
🐛 [esi] Processing job #123457 (attempt 1/3)
🐛   ↳ Fetched character 987654: John Doe
🐛 [esi] ✅ Job #123457 completed
🐛 [killmail-fetch] Processing job #123458 (attempt 1/3)
🐛   ↳ Fetched and saved killmail 123458
🐛 [killmail-fetch] ✅ Job #123458 completed
...

📊 Queue Statistics:
   killmail-fetch: 1,670,884 pending, 65 processing
   esi: 157,843 pending, 5 processing
   price-fetch: 0 pending, 0 processing
   type-fetch: 0 pending, 1 processing
   Rate: 4.20 jobs/sec (126 total in 30s)
   Active: 71 jobs currently processing
```

**Pros:**
- See every job being processed
- Great for debugging issues
- Immediate feedback

**Cons:**
- Very verbose output
- Can slow down terminal rendering
- Harder to spot issues in the noise

## Monitoring

For real-time monitoring without verbose logs, use the status command in a separate terminal:

```bash
bun cli queue:status
```

This shows a live dashboard that refreshes every 2 seconds with:
- Queue stats (pending/processing/failed)
- Processing rates
- Currently active jobs
- System information

## Recommendations

### Development
- Use **DEBUG mode** when testing new workers or debugging issues
- Use `queue:status` in a separate terminal for monitoring

### Production
- Use **INFO mode** for clean, periodic statistics
- Use `queue:status` for manual monitoring
- Set up log aggregation to capture all logs (including debug)
- Consider using PM2 or systemd for automatic log rotation

## Troubleshooting

### "Output just stops"

If you see the initial startup messages but then no output:

1. **You're in INFO mode** - This is expected! Stats are printed every 30 seconds.
   - Wait 30 seconds for the first stats report
   - Or switch to DEBUG mode: `LOG_LEVEL=debug bun cli queue:work`

2. **No jobs are being processed** - Check if jobs are available:
   ```bash
   bun cli queue:status --once
   ```

3. **Workers are stuck** - Some jobs might be processing for a long time:
   - Check `queue:status` to see currently processing jobs
   - Look for jobs that have been processing for hours

### High CPU/Memory Usage

If running in DEBUG mode with high throughput (100+ jobs/sec):
- Switch to INFO mode to reduce terminal rendering overhead
- Use log file redirection: `bun cli queue:work 2>&1 | tee worker.log`

### Missing Logs

If you don't see any logs at all:
- Check that you're running the correct command: `bun cli queue:work`
- Verify no output redirection or log filters are active
- Try DEBUG mode to see if any jobs are being processed

## Configuration

### Change Stats Interval

Edit `/app/queue/queue-manager.ts`:

```typescript
// Change from 30000ms (30s) to desired interval
this.statsInterval = setInterval(() => this.logStats(), 30000);
```

### Change Log Level Programmatically

Set the `LOG_LEVEL` environment variable:

```bash
# In .env file
LOG_LEVEL=debug

# Or inline
LOG_LEVEL=debug bun cli queue:work
```

Valid levels: `debug`, `info`, `warn`, `error`
