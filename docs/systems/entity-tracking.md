# Entity Tracking System

The entity tracking system maintains up-to-date information about EVE Online entities (characters, corporations, alliances) by fetching data from the ESI API.

## Overview

Entities are updated through two mechanisms:

1. **Lazy loading** - When an entity is requested but missing or stale
2. **Background updates** - After killmail processing extracts entity IDs

## Entity Types

### Character

- **Table**: `characters`
- **ESI Endpoint**: `/characters/{id}/`
- **Queue**: `QueueType.CHARACTER`
- **Update Frequency**: 7 days
- **Key Fields**: name, corporationId, allianceId, factionId, birthday, title

### Corporation

- **Table**: `corporations`
- **ESI Endpoint**: `/corporations/{id}/`
- **Queue**: `QueueType.CORPORATION`
- **Update Frequency**: 7 days
- **Key Fields**: name, ticker, memberCount, allianceId, factionId, ceoId, dateFounded, warEligible

### Alliance

- **Table**: `alliances`
- **ESI Endpoint**: `/alliances/{id}/`
- **Queue**: `QueueType.ALLIANCE`
- **Update Frequency**: 7 days
- **Key Fields**: name, ticker, dateFounded, executorCorporationId, factionId

## Data Flow

```text
┌──────────────────────────────────────────────────────────────┐
│                    Entity ID Sources                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Killmails   │  │  User Click  │  │  Manual Backfill │    │
│  │  (extracted) │  │  (page view) │  │  (CLI command)   │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘    │
└─────────┼──────────────────┼───────────────────┼──────────────┘
          │                  │                   │
          └──────────────────┼───────────────────┘
                             ▼
                  ┌─────────────────────┐
                  │  Check if stale     │
                  │  (> 7 days old)     │
                  └──────────┬──────────┘
                             │
                    ┌────────┴────────┐
                    │  Fresh  │ Stale │
                    ▼         ▼       │
              ┌─────────┐  ┌──────────▼──────┐
              │ Use DB  │  │  Entity Queue   │
              │  Data   │  │ (LOW priority)  │
              └─────────┘  └────────┬─────────┘
                                    ▼
                          ┌────────────────────┐
                          │ Fetch from ESI     │
                          │ - Character info   │
                          │ - Corporation info │
                          │ - Alliance info    │
                          └──────────┬─────────┘
                                     ▼
                          ┌────────────────────┐
                          │  Store in DB       │
                          │  - Update or insert│
                          │  - Set lastUpdated │
                          └────────────────────┘
```

## Queue Processors

### Character Processor (`queue/character.ts`)

```typescript
export const processor = async (job: Job<{ id: number }>) => {
  const { id } = job.data;

  // Check if we have recent data
  const existing = await getCharacter(id);
  if (existing && !isStale(existing.lastUpdated, 7)) {
    return { cached: true };
  }

  // Fetch from ESI
  const character = await fetchCharacterFromESI(id);

  // Store in database
  await storeCharacter(character);

  return { updated: true };
};
```

**Features**:

- Skips if data is fresh (< 7 days)
- Handles NPC characters (special IDs < 2000000)
- Retries on ESI errors (3 attempts)
- Logs failures for monitoring

### Corporation Processor (`queue/corporation.ts`)

Similar to character processor, but also:

- Checks NPC corporations table first
- Updates alliance membership
- Tracks CEO character ID

### Alliance Processor (`queue/alliance.ts`)

Similar pattern, also:

- Updates executor corporation
- Tracks member corporation count (via separate query if needed)

## Database Schema

### Characters Table

```sql
CREATE TABLE characters (
  "id" INTEGER PRIMARY KEY,
  "name" TEXT NOT NULL,
  "corporationId" INTEGER NOT NULL,
  "allianceId" INTEGER,
  "factionId" INTEGER,
  "birthday" TIMESTAMP,
  "title" TEXT,
  "securityStatus" NUMERIC(10,2),
  "lastUpdated" TIMESTAMP DEFAULT NOW(),
  "deleted" BOOLEAN DEFAULT false
);

CREATE INDEX idx_characters_corporation ON characters("corporationId");
CREATE INDEX idx_characters_alliance ON characters("allianceId");
CREATE INDEX idx_characters_faction ON characters("factionId");
CREATE INDEX idx_characters_name_trgm ON characters USING gin(name gin_trgm_ops);
```

### Corporations Table

```sql
CREATE TABLE corporations (
  "id" INTEGER PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ticker" VARCHAR(10) NOT NULL,
  "memberCount" INTEGER,
  "allianceId" INTEGER,
  "factionId" INTEGER,
  "ceoId" INTEGER,
  "creatorId" INTEGER,
  "dateFounded" TIMESTAMP,
  "description" TEXT,
  "warEligible" BOOLEAN,
  "lastUpdated" TIMESTAMP DEFAULT NOW(),
  "deleted" BOOLEAN DEFAULT false
);

CREATE INDEX idx_corporations_alliance ON corporations("allianceId");
CREATE INDEX idx_corporations_faction ON corporations("factionId");
CREATE INDEX idx_corporations_ticker_trgm ON corporations USING gin(ticker gin_trgm_ops);
CREATE INDEX idx_corporations_name_trgm ON corporations USING gin(name gin_trgm_ops);
```

### Alliances Table

```sql
CREATE TABLE alliances (
  "id" INTEGER PRIMARY KEY,
  "name" TEXT NOT NULL,
  "ticker" VARCHAR(10) NOT NULL,
  "dateFounded" TIMESTAMP,
  "executorCorporationId" INTEGER,
  "factionId" INTEGER,
  "lastUpdated" TIMESTAMP DEFAULT NOW(),
  "deleted" BOOLEAN DEFAULT false
);

CREATE INDEX idx_alliances_faction ON alliances("factionId");
CREATE INDEX idx_alliances_ticker_trgm ON alliances USING gin(ticker gin_trgm_ops);
CREATE INDEX idx_alliances_name_trgm ON alliances USING gin(name gin_trgm_ops);
```

## Staleness Logic

Entities are considered stale after 7 days:

```typescript
function isStale(lastUpdated: Date, days: number = 7): boolean {
  const now = new Date();
  const age = now.getTime() - lastUpdated.getTime();
  const maxAge = days * 24 * 60 * 60 * 1000;
  return age > maxAge;
}
```

## Fetcher Helpers

### Character Fetcher (`server/fetchers/character.ts`)

```typescript
export async function fetchCharacterFromESI(id: number): Promise<Character> {
  const esiData = await fetchESI<ESICharacter>(`/characters/${id}/`);

  return {
    id,
    name: esiData.name,
    corporationId: esiData.corporation_id,
    allianceId: esiData.alliance_id,
    factionId: esiData.faction_id,
    birthday: new Date(esiData.birthday),
    title: esiData.title,
    securityStatus: esiData.security_status,
    lastUpdated: new Date(),
  };
}
```

**Error Handling**:

- 404: Mark as deleted
- 420: Rate limited, retry with backoff
- 5xx: ESI error, retry
- Timeout: Retry with exponential backoff

### Cached Access Pattern

Models provide "get or enqueue" helpers:

```typescript
export async function getCharacter(id: number): Promise<Character | null> {
  const character = await database.findOne<Character>(
    `SELECT * FROM characters WHERE id = :id`,
    { id }
  );

  // If missing or stale, enqueue update
  if (!character || isStale(character.lastUpdated)) {
    await enqueueJob(
      QueueType.CHARACTER,
      { id },
      { priority: JobPriority.LOW }
    );
  }

  return character;
}
```

## Special Cases

### NPC Entities

**NPC Characters** (id < 3000000)

- Not fetched from ESI
- Static data from SDE (`npcCharacters` table)
- Never updated

**NPC Corporations** (id < 2000000)

- Fetched from SDE (`npcCorporations` table)
- Includes factionId from SDE
- Never updated via ESI

### Deleted Entities

When ESI returns 404:

- Set `deleted = true`
- Keep historical data for killmail references
- Display as "[Deleted Character]" in UI

### Faction Characters

Faction entities have `factionId` set:

- Caldari State: 500001
- Minmatar Republic: 500002
- Amarr Empire: 500003
- Gallente Federation: 500004

## Affiliation Updates

For bulk updates, use the affiliation endpoint:

```bash
bun cli affiliation-update --character-ids 123,456,789
```

**Benefits**:

- Single ESI call for multiple IDs
- Updates corporation/alliance membership
- More efficient than individual fetches

**Endpoint**: `/characters/affiliation/`

## Performance Optimization

### Batch Enqueuing

After processing killmails, batch entity IDs:

```typescript
const characterIds = [...new Set(allCharacterIds)]; // Deduplicate
await enqueueJobMany(
  QueueType.CHARACTER,
  characterIds.map((id) => ({ id })),
  { priority: JobPriority.LOW, delay: 10000 }
);
```

### Rate Limiting

- ESI limit: 150 requests/second burst
- Queue concurrency: 5 per entity type
- Delayed processing prevents overwhelming ESI

### Caching Strategy

- 7-day staleness for entities (rarely change)
- Redis cache for frequently accessed entities
- Database as source of truth

## CLI Commands

```bash
# Update specific entity
bun cli debug:update-character 123456789

# Backfill entity data
bun cli backfills:everef-entities --type character --start-id 90000000

# Check entity data quality
bun cli debug:check-data --entities

# Clear entity queues
bun cli queue:clear character --all
```

## Monitoring

### Key Metrics

- Entity update rate (entities/minute)
- ESI error rate per entity type
- Queue backlog size
- Staleness distribution (how many entities > 7 days old)

### Health Checks

- Monitor for 404 rate (deleted entities)
- Track ESI 5xx errors
- Alert on queue backlog > 10,000
