# Kills Page Filter Examples

This document shows examples of how filters work for different kill types.

## Example 1: Latest Kills (`/kills/latest`)

**Server-Side Filters:**
```typescript
const filters = {}; // No filters - show all recent kills
```

**Filter Config (WebSocket):**
```json
{
  "type": "latest"
}
```

**Behavior:**
- ✅ Shows ALL recent killmails
- ✅ No ship type filtering
- ✅ No value filtering
- ✅ No location filtering
- ✅ No entity filtering

## Example 2: Big Kills (`/kills/big`)

**Server-Side Filters:**
```typescript
const filters = {
  shipGroupIds: [547, 485, 513, 902, 941, 30, 659]
};
```

**Filter Config (WebSocket):**
```json
{
  "type": "big",
  "shipGroupIds": [547, 485, 513, 902, 941, 30, 659]
}
```

**Behavior:**
- ✅ Shows kills where victim ship is in the specified groups (capitals, supers, titans, freighters)
- ✅ No entity filtering
- ❌ Filters out kills of non-capital ships

## Example 3: Solo Kills (`/kills/solo`)

**Server-Side Filters:**
```typescript
const filters = {
  isSolo: true
};
```

**Filter Config (WebSocket):**
```json
{
  "type": "solo",
  "isSolo": true
}
```

**Behavior:**
- ✅ Shows only kills with exactly 1 attacker
- ✅ No entity filtering
- ❌ Filters out kills with multiple attackers

## Example 4: 5B+ Kills (`/kills/5b`)

**Server-Side Filters:**
```typescript
const filters = {
  minValue: 5_000_000_000
};
```

**Filter Config (WebSocket):**
```json
{
  "type": "5b",
  "minValue": 5000000000
}
```

**Behavior:**
- ✅ Shows only kills worth 5 billion ISK or more
- ✅ No entity filtering
- ❌ Filters out kills under 5 billion ISK

## Example 5: High-Sec Kills (`/kills/highsec`)

**Server-Side Filters:**
```typescript
const filters = {
  minSecurityStatus: 0.45
};
```

**Filter Config (WebSocket):**
```json
{
  "type": "highsec",
  "minSecurityStatus": 0.45
}
```

**Behavior:**
- ✅ Shows only kills in high-security space (0.45+)
- ✅ No entity filtering
- ❌ Filters out kills in low-sec, null-sec, wormholes, etc.

## Example 6: W-Space Kills (`/kills/w-space`)

**Server-Side Filters:**
```typescript
const filters = {
  regionIdMin: 11000001,
  regionIdMax: 11000033
};
```

**Filter Config (WebSocket):**
```json
{
  "type": "w-space",
  "regionIdMin": 11000001,
  "regionIdMax": 11000033
}
```

**Behavior:**
- ✅ Shows only kills in wormhole regions (11000001-11000033)
- ✅ No entity filtering
- ❌ Filters out kills outside wormhole space

## Example 7: Character Page - All (`/character/123`)

**Server-Side Filters:**
```typescript
const filters = {
  characterIds: [123]
};
```

**Filter Config (WebSocket):**
```json
{
  "type": "all",
  "characterIds": [123]
}
```

**Behavior:**
- ✅ Shows kills where character 123 is involved (as victim OR attacker)
- ✅ Entity filtering applies
- ❌ Filters out kills not involving character 123

## Example 8: Character Page - Kills Only (`/character/123/kills`)

**Server-Side Filters:**
```typescript
const filters = {
  characterIds: [123],
  killsOnly: true
};
```

**Filter Config (WebSocket):**
```json
{
  "type": "kills",
  "characterIds": [123]
}
```

**Behavior:**
- ✅ Shows only kills where character 123 is an attacker
- ✅ Entity filtering applies
- ❌ Filters out kills where character 123 is the victim

## Key Differences

### Kill Type Filters vs. Entity Filters

**Kill Type Filters** (`latest`, `big`, `solo`, etc.):
- Filter by **kill characteristics** (ship type, value, location, etc.)
- Do NOT filter by entity involvement
- Show ALL kills matching the characteristics
- Used on `/kills/*` pages

**Entity Filters** (`all`, `kills`, `losses`):
- Filter by **entity involvement** (character, corp, alliance)
- May also include kill characteristics
- Show only kills involving the specified entities
- Used on entity pages (`/character/*`, `/corporation/*`, etc.)

### Filter Priority

When multiple filters are present, ALL must match:
1. Location filters (system, region, security)
2. Ship filters (ship group IDs)
3. Type filters (solo, NPC, minimum value)
4. Entity filters (only if type is 'all', 'kills', or 'losses')

A killmail is shown only if it passes **all active filters**.
