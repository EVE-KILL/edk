# Backfill Command Documentation

## Overview

The `backfill` command fetches historical killmails from EVE-KILL's API for your followed entities. This is useful for populating your database with historical data before starting the real-time RedisQ listener.

## How It Works

1. **Reads Configuration**: Parses `FOLLOWED_*` environment variables to determine which entities to backfill
2. **Queries EVE-KILL**: Sends POST requests to `https://eve-kill.com/api/query` with MongoDB-style filters
3. **Paginates Results**: Fetches killmails in batches (default: 1000 per page) using skip/limit pagination
4. **Checks for Duplicates**: Verifies each killmail doesn't already exist in your database
5. **Enqueues New Killmails**: Adds new killmails to the `killmail-fetch` queue for processing
6. **Continues Until Complete**: Keeps fetching until no more results are returned (fewer than batch size)

## Usage

### Basic Usage
```bash
# Backfill all historical killmails for followed entities
bun cli backfill
```

### With Options
```bash
# Limit to 10,000 killmails
bun cli backfill --limit=10000

# Use smaller batch size (500 per page)
bun cli backfill --batch=500

# Combine options
bun cli backfill --limit=5000 --batch=250
```

### Show Help
```bash
bun cli backfill --help
```

## Prerequisites

You **must** configure at least one followed entity in your `.env` file:

```env
FOLLOWED_CHARACTER_IDS=12345,67890
FOLLOWED_CORPORATION_IDS=98765432
FOLLOWED_ALLIANCE_IDS=1900696668,99003581
```

If no entities are configured, the command will exit with an error.

## Query Structure

The backfill command sends queries to EVE-KILL in this format:

```json
{
  "filter": {
    "$or": [
      {
        "victim.character_id": { "$in": [12345, 67890] },
        "victim.corporation_id": { "$in": [98765432] },
        "victim.alliance_id": { "$in": [1900696668, 99003581] }
      },
      {
        "attackers.character_id": { "$in": [12345, 67890] },
        "attackers.corporation_id": { "$in": [98765432] },
        "attackers.alliance_id": { "$in": [1900696668, 99003581] }
      }
    ]
  },
  "options": {
    "limit": 1000,
    "skip": 0,
    "sort": { "kill_time": -1 },
    "projection": { "killmail_id": 1, "killmail_hash": 1 }
  }
}
```

This finds killmails where any followed entity appears as either victim OR attacker.

## Output Example

```
🔄 EVE-KILL Backfill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Configuration:
   Alliances: 1900696668, 99003581
   Batch size: 1000

Press Ctrl+C to stop

📡 Fetching page 1 (skip: 0, limit: 1000)...
   Fetched: 1000 | New: 847 | Duplicate: 153
📡 Fetching page 2 (skip: 1000, limit: 1000)...
   Fetched: 2000 | New: 1654 | Duplicate: 346
📡 Fetching page 3 (skip: 2000, limit: 1000)...
   Fetched: 2750 | New: 2156 | Duplicate: 594

✅ No more killmails to fetch - backfill complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Final Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Pages fetched: 3
   Killmails fetched: 2750
   New: 2156
   Duplicate: 594
   Errors: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Backfill complete! 2156 new killmails queued for processing.

💡 Tip: Monitor queue progress with queue workers or check the database.
```

## Options

### `--limit=<number>`
- **Description**: Maximum number of killmails to fetch
- **Default**: Unlimited (fetches until no more results)
- **Example**: `--limit=10000` stops after 10,000 killmails

### `--batch=<number>`
- **Description**: Number of killmails to fetch per API request
- **Default**: 1000
- **Recommended**: 500-1000 (larger batches = fewer requests but slower responses)
- **Example**: `--batch=500` fetches 500 killmails per page

## Best Practices

### 1. Run Backfill Before RedisQ
```bash
# Step 1: Backfill historical data
bun cli backfill

# Step 2: Start real-time listener
bun cli redisq
```

This ensures you have historical context before starting real-time import.

### 2. Use Limits for Testing
```bash
# Test with small dataset first
bun cli backfill --limit=100
```

### 3. Monitor Progress
The command prints progress after each page fetch. You can:
- Stop at any time with `Ctrl+C` (graceful shutdown)
- Resume later (duplicate checking prevents re-importing)

### 4. Run Queue Workers
The backfill command only **enqueues** killmails. You need queue workers running to actually fetch and process them:

```bash
# In separate terminal - run queue workers
bun cli queue:work
```

## Performance Considerations

### API Rate Limiting
- EVE-KILL's API has no strict rate limits for this endpoint
- The command includes `User-Agent: EVE-Kill/4.0` for identification
- Pagination happens sequentially (one page at a time)

### Database Performance
- Each killmail checks for duplicates with a database query
- For large backfills (100k+ killmails), this can take time
- Consider running `VACUUM` after large backfills

### Queue Processing
- Backfill is **fast** (seconds to enqueue thousands of killmails)
- Queue processing is **slow** (minutes to hours depending on volume)
- Each killmail requires ESI API calls for entities (characters, corps, alliances)

## Typical Workflow

### New Installation
```bash
# 1. Bootstrap the system
bun cli bootstrap

# 2. Configure followed entities in .env
nano .env

# 3. Backfill historical data
bun cli backfill

# 4. Start queue workers (in separate terminal)
bun cli queue:work

# 5. Start real-time import (in separate terminal)
bun cli redisq

# 6. Start web server (in separate terminal)
bun index.ts
```

### Updating Followed Entities
```bash
# 1. Add new entities to .env
nano .env

# 2. Backfill for new entities
bun cli backfill

# 3. RedisQ will automatically filter for new entities
```

## Troubleshooting

### "No followed entities configured"
- **Cause**: Missing or empty `FOLLOWED_*` environment variables
- **Fix**: Add at least one entity to `.env`:
  ```env
  FOLLOWED_ALLIANCE_IDS=1900696668
  ```

### "Error fetching batch: HTTP 500"
- **Cause**: EVE-KILL API error or invalid query
- **Fix**: Check EVE-KILL status, try again later, or reduce batch size

### "Backfill hangs"
- **Cause**: Very large result set or API slowness
- **Fix**: Use `--batch=500` to reduce page size, or `Ctrl+C` and resume later

### "New killmails not appearing"
- **Cause**: Queue workers not running
- **Fix**: Start queue workers with `bun cli queue:work`

## Comparison: Backfill vs RedisQ

| Feature | Backfill | RedisQ |
|---------|----------|--------|
| **Purpose** | Historical data | Real-time data |
| **Source** | EVE-KILL API | zkillboard RedisQ |
| **Speed** | Fast (batch queries) | Slow (one at a time) |
| **Coverage** | Complete history | Only new killmails |
| **Filtering** | Required (FOLLOWED_*) | Optional (FOLLOWED_*) |
| **Use Case** | Initial setup | Ongoing monitoring |

## Advanced Usage

### Backfill Specific Time Range
Currently not supported via command options. You would need to modify the query in the code:

```typescript
// In backfill.ts, modify the query:
const query = {
  filter: {
    ...filter,
    kill_time: {
      $gte: "2024-01-01T00:00:00Z",
      $lte: "2024-12-31T23:59:59Z"
    }
  },
  // ... rest of query
};
```

### Backfill and Process Immediately
```bash
# Terminal 1: Start queue workers first
bun cli queue:work

# Terminal 2: Run backfill
bun cli backfill --limit=1000
```

Queue workers will process killmails as they're enqueued.

## Integration with Bootstrap

The bootstrap command's next steps include backfill:

```bash
bun cli bootstrap
# ... shows instructions to run backfill ...
```

This ensures new users know to backfill before starting real-time import.

## API Reference

### EVE-KILL Query API
- **Endpoint**: `https://eve-kill.com/api/query`
- **Method**: POST
- **Content-Type**: `application/json`
- **Authentication**: None required

### Response Format
```json
{
  "data": [
    {
      "killmail_id": 123456789,
      "killmail_hash": "abc123..."
    }
  ],
  "count": 1000,
  "total": 15000
}
```

## Future Enhancements

Potential improvements:
- [ ] Parallel page fetching
- [ ] Time range filters (--from, --to)
- [ ] Resume from specific skip value
- [ ] Progress bar with estimated time remaining
- [ ] Export to JSON before importing
- [ ] Dry-run mode (show what would be imported)

## See Also

- `bun cli redisq --help` - Real-time killmail import
- `bun cli bootstrap --help` - System setup
- `bun cli queue:work --help` - Queue processing
- [EVE-KILL API Documentation](https://eve-kill.com/docs/api/query)
