# Kills Page Filters - Implementation

## Overview

The kills page (`/kills/[type]`) now has comprehensive filtering support similar to character, corporation, alliance, and entities pages. This includes both server-side filtering (for initial page load) and client-side filtering (for WebSocket real-time updates).

## Implemented Filters

### Server-Side Filters (KilllistFilters)
These filters are applied when generating the initial killlist and are defined in `/app/generators/killlist.ts`:

1. **Entity Filters**
   - `characterIds`: Array of character IDs
   - `corporationIds`: Array of corporation IDs
   - `allianceIds`: Array of alliance IDs
   - `killsOnly`: Show only kills (entity as attacker)
   - `lossesOnly`: Show only losses (entity as victim)

2. **Location Filters**
   - `systemId`: Specific solar system ID
   - `regionId`: Specific region ID
   - `regionIdMin`/`regionIdMax`: Region ID range (for abyssal/wspace)
   - `minSecurityStatus`: Minimum security status
   - `maxSecurityStatus`: Maximum security status

3. **Ship Filters**
   - `shipGroupIds`: Array of ship group IDs (victim ship)

4. **Type Filters**
   - `isSolo`: Solo kills only
   - `isNpc`: NPC kills only
   - `minValue`: Minimum total ISK value

5. **Pagination**
   - `offset`: Result offset
   - `before`: Timestamp for cursor-based pagination

### Client-Side Filters (WebSocket)
The WebSocket filter configuration is stored in the `data-filter-config` attribute on the killlist container and includes:

```javascript
{
  type: 'all',              // Kill type (latest, big, solo, etc.)
  systemId: null,           // Solar system filter
  regionId: null,           // Region filter
  regionIdMin: null,        // Region range minimum
  regionIdMax: null,        // Region range maximum
  characterIds: [],         // Character IDs to filter
  corporationIds: [],       // Corporation IDs to filter
  allianceIds: [],          // Alliance IDs to filter
  shipGroupIds: [],         // Ship group IDs to filter
  isSolo: false,            // Solo kills filter
  isNpc: false,             // NPC kills filter
  minValue: null,           // Minimum ISK value
  minSecurityStatus: null,  // Minimum security status
  maxSecurityStatus: null,  // Maximum security status
}
```

## Implementation Details

### Route Handler (`/app/routes/kills/[type].ts`)

The route handler builds comprehensive filter configuration:

1. **Build Filters**: Uses `buildFiltersForType()` to create server-side filters based on the kill type
2. **Generate Data**: Fetches killmails, stats, and top 10 with the same filters
3. **Build Filter Config**: Creates a complete `filterConfig` object that includes all active filters
4. **Pass to Template**: The `filterConfig` is passed to the template and stored in `data-filter-config`

Example for "big" kills:
```typescript
const filters = {
  shipGroupIds: [547, 485, 513, 902, 941, 30, 659], // Capitals, supers, titans, freighters
};

const filterConfig = {
  type: 'big',
  shipGroupIds: [547, 485, 513, 902, 941, 30, 659],
};
```

**Important Note**: The `type` field serves dual purposes:
- For **entity pages** (character/corp/alliance): it's 'all', 'kills', or 'losses' to filter by involvement
- For **kills pages**: it's the kill type itself ('big', 'solo', etc.) - entity filtering is NOT applied

### WebSocket Emitter (`/app/queue/websocket-emitter.ts`)

Enhanced to include additional fields needed for filtering:

- `attacker_count`: Number of attackers (for solo filtering)
- `victim.ship.group_id`: Ship group ID (for ship type filtering)
- `solar_system.region_id`: Region ID (for region filtering)
- `ship_value`: Uses `totalValue` (not `shipValue`) for accurate total killmail value

**Important**: The `ship_value` in WebSocket messages represents the **total killmail value** (ship + fitted items + cargo), matching what's displayed in the killlist. This ensures value filtering works correctly.

### WebSocket Filter Logic (`/templates/default/static/killlist-updates.js`)

The `matchesFilters()` method now checks:

1. **Location Filters**
   - System ID match
   - Region ID match
   - Region range (for abyssal/wspace)
   - Security status range

2. **Ship Filters**
   - Ship group ID match for victim ship

3. **Type Filters**
   - Solo kills (attacker_count === 1)
   - NPC kills (victim has no character ID)
   - Minimum ISK value

4. **Entity Filters** (only when `type` is 'all', 'kills', or 'losses')
   - Character/corporation/alliance involvement
   - Respects kill type (all/kills/losses)
   - **Skipped for kill type filters** (e.g., 'big', 'solo') to avoid double-filtering

## Kill Types Supported

All existing kill types continue to work with expanded filtering:

- `latest`: Latest kills (no filters)
- `big`: Big kills (capitals, supers, titans, freighters)
- `solo`: Solo kills
- `npc`: NPC kills
- `highsec`/`lowsec`/`nullsec`: Security status filters
- `w-space`: Wormhole space (region 11000001-11000033)
- `abyssal`: Abyssal space (region 12000000-13000000)
- `pochven`: Pochven region (10000070)
- `5b`/`10b`: Minimum ISK value filters
- Ship class filters: `frigates`, `destroyers`, `cruisers`, etc.
- Tech level filters: `t1`, `t2`, `t3`
- Structure filters: `citadels`, `structures`

## WebSocket Real-Time Updates

When a new killmail arrives via WebSocket:

1. **Parse Filter Config**: Load from `data-filter-config` attribute
2. **Check Filters**: Run through `matchesFilters()` method
3. **Add if Match**: Only add to killlist if all filters pass
4. **Animate**: Fade in the new row at the top
5. **Remove Oldest**: Maintain consistent count by removing oldest

This ensures that real-time updates only show killmails that match the current page's filters.

## Benefits

1. **Consistency**: Real-time updates match initial page load filters
2. **Performance**: Client-side filtering prevents unnecessary DOM updates
3. **User Experience**: Users see relevant kills without page refreshes
4. **Extensibility**: Easy to add new filter types in the future

## Future Enhancements

Potential improvements:

1. **URL Query Params**: Allow users to customize filters via URL parameters
2. **Filter UI**: Add interactive filter controls to the page
3. **Filter Combinations**: Allow combining multiple kill types
4. **Saved Filters**: Let users save their favorite filter configurations
5. **Advanced Filters**: Add more granular filtering options (date ranges, item types, etc.)
