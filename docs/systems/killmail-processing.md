# Killmail Processing System

The killmail processing system ingests killmails from multiple sources, enriches them with ESI data, and stores them in PostgreSQL.

## Data Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Ingestion Sources                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   RedisQ     │  │  EVE-KILL WS │  │  Manual Backfill     │   │
│  │ (zKillboard) │  │  (WebSocket) │  │  (CLI commands)      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
└─────────┼──────────────────┼────────────────────┼───────────────┘
          │                  │                    │
          └──────────────────┼────────────────────┘
                             ▼
                    ┌────────────────────┐
                    │  Killmail Queue    │
                    │  (BullMQ - HIGH)   │
                    └─────────┬──────────┘
                              ▼
                    ┌────────────────────┐
                    │ Queue Processor    │
                    │ - Deduplication    │
                    │ - ESI enrichment   │
                    │ - Value calculation│
                    └─────────┬──────────┘
                              ▼
                    ┌────────────────────┐
                    │   PostgreSQL       │
                    │ - killmails table  │
                    │ - attackers table  │
                    │ - items table      │
                    └─────────┬──────────┘
                              ▼
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
    ┌────────────┐                        ┌──────────────┐
    │  WebSocket │                        │ Entity Queues│
    │  Broadcast │                        │ (LOW priority)│
    └────────────┘                        └──────────────┘
```

## Components

### 1. Ingestion Sources

**RedisQ Listener** (`commands/listeners/redisq.ts`)

- Polls zKillboard's RedisQ for new killmails
- Uses unique `REDISQ_ID` from environment
- Enqueues killmails with HIGH priority
- Automatic retry on failures

**EVE-KILL WebSocket** (`commands/listeners/ekws.ts`)

- Connects to `wss://ws.eve-kill.com/killmails`
- Real-time killmail stream
- Optional entity filtering
- Auto-reconnection with backoff

**Manual Backfill** (Various CLI commands)

- `bun cli backfills:zkillboard` - Historical zKillboard data
- `bun cli backfills:eve-kill` - EVE-KILL historical data
- Uses NORMAL priority to not interfere with real-time processing

### 2. Killmail Queue

**Queue Configuration**

```typescript
QueueType.KILLMAIL
Priority: JobPriority.HIGH (real-time)
Priority: JobPriority.NORMAL (backfill)
Concurrency: 10 workers
```

**Job Data**

```typescript
{
  killmailId: number;
  hash: string;
  source?: string; // 'redisq', 'ekws', 'backfill'
}
```

### 3. Processing Logic

**Deduplication**

- Check if killmail already exists by `killmailId`
- Skip processing if already stored
- Log duplicate attempts for monitoring

**ESI Enrichment**

- Fetch complete killmail from ESI: `/killmails/{id}/{hash}/`
- Extract victim and attacker details
- Extract destroyed and dropped items

**Value Calculation**

- Lookup item prices from `prices` table
- Calculate total destroyed value
- Calculate total dropped value
- Store combined `totalValue`

**Entity Extraction**

- Extract all character IDs (victim + attackers)
- Extract all corporation IDs
- Extract all alliance IDs (if present)
- Enqueue LOW priority jobs to update entity data

### 4. Database Storage

**Schema Design**
The killmail data is denormalized across three tables for query performance:

**killmails table** (partitioned by month)

```sql
CREATE TABLE killmails (
  "killmailId" BIGINT PRIMARY KEY,
  "killmailTime" TIMESTAMP NOT NULL,
  "solarSystemId" INTEGER NOT NULL,
  "totalValue" NUMERIC(20,2),
  -- Victim fields (denormalized)
  "victimCharacterId" INTEGER,
  "victimCorporationId" INTEGER,
  "victimAllianceId" INTEGER,
  "victimFactionId" INTEGER,
  "victimShipTypeId" INTEGER,
  "victimDamageTaken" INTEGER,
  -- Additional metadata
  "hash" VARCHAR(255) NOT NULL,
  "isNPC" BOOLEAN DEFAULT false,
  "isAwoxing" BOOLEAN DEFAULT false,
  "isSolo" BOOLEAN DEFAULT false,
  -- ...
) PARTITION BY RANGE ("killmailTime");
```

**attackers table**

```sql
CREATE TABLE attackers (
  "id" SERIAL PRIMARY KEY,
  "killmailId" BIGINT NOT NULL REFERENCES killmails("killmailId"),
  "characterId" INTEGER,
  "corporationId" INTEGER,
  "allianceId" INTEGER,
  "factionId" INTEGER,
  "shipTypeId" INTEGER,
  "weaponTypeId" INTEGER,
  "damageDone" INTEGER,
  "finalBlow" BOOLEAN DEFAULT false
);
```

**items table**

```sql
CREATE TABLE items (
  "id" SERIAL PRIMARY KEY,
  "killmailId" BIGINT NOT NULL REFERENCES killmails("killmailId"),
  "typeId" INTEGER NOT NULL,
  "flag" INTEGER,
  "quantityDestroyed" INTEGER,
  "quantityDropped" INTEGER,
  "singleton" BOOLEAN DEFAULT false
);
```

### 5. Post-Processing

**Entity Updates**
After storing a killmail, entity IDs are enqueued to update their information:

```typescript
// Low priority, delayed by 10 seconds
await enqueueJobMany(
  QueueType.CHARACTER,
  characterIds.map((id) => ({ id })),
  { priority: JobPriority.LOW, delay: 10000 }
);
```

**WebSocket Broadcast**
If WebSocket server is running, broadcast new killmail to connected clients:

```typescript
{
  type: 'killmail',
  data: {
    killmailId,
    killmailTime,
    totalValue,
    victim: { ... },
    solarSystem: { ... }
  }
}
```

## Performance Considerations

### Partitioning

- Killmails table is partitioned by month
- Each partition has its own indexes
- Automatic partition creation via cron job
- Queries should include time range when possible

### Batch Operations

- Use `database.bulkInsert()` for attackers and items
- Process multiple killmails in parallel (concurrency: 10)
- Rate limit ESI requests (150 req/s burst)

### Deduplication

- Check existence before processing
- Use unique constraint on `killmailId`
- Track processing metrics for monitoring

## Monitoring

### Queue Metrics

```typescript
const stats = await getQueueStats(QueueType.KILLMAIL);
// Returns: waiting, active, completed, failed counts
```

### Processing Stats

- Track killmails/second ingestion rate
- Monitor ESI API errors
- Alert on high failure rates
- Track queue backlog size

## Error Handling

### Retry Logic

- BullMQ automatic retry with exponential backoff
- Max 3 attempts for transient failures
- Failed jobs moved to failed queue for manual review

### Common Errors

- **ESI timeout**: Retry automatically
- **Invalid hash**: Skip, log for investigation
- **Duplicate killmail**: Skip silently
- **Database constraint violation**: Skip, check for race conditions

## CLI Commands

```bash
# Monitor queue status
bun cli queue:stats killmail

# Clear failed jobs
bun cli queue:clear killmail --failed

# Backfill historical data
bun cli backfills:zkillboard --start-date 2024-01-01

# Check processing health
bun cli debug:check-data
```
