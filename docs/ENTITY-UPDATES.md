# Entity Update WebSocket System

## Overview

The EVE Kill v4 system now includes a real-time entity update system that broadcasts entity data (characters, corporations, alliances, ship types, systems, regions) to connected WebSocket clients. This solves the issue where entity names may not be available immediately when a killmail is first processed, but become available later after ESI/EVE-KILL data is fetched.

## Problem Solved

In a distributed, asynchronous system, entities may be referenced before their data is available:

```
1. Killmail posted → {character_id: 123, name: null}
2. Frontend shows "Unknown (ID: 123)"
3. Background worker fetches ESI data → {character_id: 123, name: "John Doe"}
4. Frontend receives entity-update broadcast → replaces "Unknown" with "John Doe"
```

## Architecture

### Backend Broadcasting

When entity data is fetched and stored in the database, it's automatically broadcast to all connected WebSocket clients:

**Entity Broadcast Service** (`src/services/entity-broadcast.ts`):
```typescript
broadcastEntityUpdate({
  entityType: "character" | "corporation" | "alliance" | "type" | "system" | "region",
  id: number,
  name: string,
});
```

### Integration Points

Automatic broadcasting happens in these ESI services:

1. **Character Service** (`app/services/esi/character-service.ts`)
   - When characters are fetched and stored
   - Broadcasts: `{ entityType: "character", id, name }`

2. **Corporation Service** (`app/services/esi/corporation-service.ts`)
   - When corporations are fetched and stored
   - Broadcasts: `{ entityType: "corporation", id, name }`

3. **Alliance Service** (`app/services/esi/alliance-service.ts`)
   - When alliances are fetched and stored
   - Broadcasts: `{ entityType: "alliance", id, name }`

4. **Type Service** (`app/services/esi/type-service.ts`)
   - When ship types are fetched and stored
   - Broadcasts: `{ entityType: "type", id, name }`

5. **Solar System Service** (`app/services/esi/solar-system-service.ts`)
   - When systems are fetched and stored
   - Broadcasts: `{ entityType: "system", id, name }`

## Frontend Implementation

### WebSocket Message Format

The WebSocket sends entity updates with this format:

```json
{
  "type": "entity-update",
  "data": {
    "entityType": "character",
    "id": 123456,
    "name": "John Doe",
    "timestamp": "2024-10-22T15:30:00.000Z"
  },
  "timestamp": 1729610400000
}
```

### HTML Data Attributes

The killmail-list partial now includes data attributes for entities that might have unknown names:

```html
<!-- Character -->
<div data-character-id="123">Unknown</div>

<!-- Corporation -->
<div data-corporation-id="456">Unknown Corp</div>

<!-- Alliance -->
<div data-alliance-id="789">Unknown Alliance</div>

<!-- Ship Type -->
<div data-type-id="587">Unknown Ship</div>

<!-- System -->
<div data-system-id="30002652">Unknown System</div>

<!-- Region -->
<div data-region-id="10000002">Unknown Region</div>
```

### JavaScript Handler

The `KilllistUpdatesManager` in `static/killlist-updates.js` handles entity updates:

```javascript
handleEntityUpdate(entityData) {
  const { entityType, id, name } = entityData;

  // Find all elements referencing this entity
  const selector = `[data-${entityType}-id="${id}"]`;
  const elements = document.querySelectorAll(selector);

  // Replace text content with actual name
  elements.forEach(el => {
    if (el.textContent.includes('Unknown') || el.textContent.includes(`#${id}`)) {
      el.textContent = name;
      el.classList.add('entity-updated');
      // Fade in effect
      el.style.opacity = '0.5';
      setTimeout(() => {
        el.style.transition = 'opacity 0.3s ease-in';
        el.style.opacity = '1';
      }, 10);
    }
  });
}
```

## User Experience Flow

### Before (No Entity Updates)

```
Timeline:
┌─ T0: Killmail posted to frontend
│  └─ Shows: "Pilot Unknown (ID: 123)"
│
├─ T1-T2: Background worker fetches ESI data
│  └─ Data stored in database (no frontend notification)
│
└─ T3: User reloads page
   └─ Now shows: "Pilot John Doe"
```

### After (With Entity Updates)

```
Timeline:
┌─ T0: Killmail posted to frontend
│  └─ Shows: "Pilot Unknown (ID: 123)" [fade]
│
├─ T1-T2: Background worker fetches ESI data
│  └─ Data stored in database
│
├─ T3: Entity update broadcast
│  └─ WebSocket sends entity-update message
│
└─ T4: Frontend updates in real-time
   └─ Shows: "Pilot John Doe" [fade in animation]
```

## CSS Styling

Elements updated with entity data get the `entity-updated` class:

```css
.entity-updated {
  transition: opacity 0.3s ease-in;
  opacity: 1;
}
```

## Implementation Checklist

- [x] Create entity-broadcast service
- [x] Integrate with character service
- [x] Integrate with corporation service
- [x] Integrate with alliance service
- [x] Integrate with type service
- [x] Integrate with solar system service
- [x] Add data attributes to killmail-list template
- [x] Add entity update handler to killlist-updates.js
- [x] Add fade animation on updates

## Future Enhancements

1. **Region Updates**: Could add region entity broadcasts when regions are updated
2. **Constellation Updates**: Could add constellation entity broadcasts
3. **Batch Updates**: Batch multiple entity updates into single WebSocket message for efficiency
4. **Entity Cache**: Frontend cache of seen entities to prevent re-broadcasting
5. **Update Priorities**: Different priority levels for entity updates (high-priority = characters, low-priority = types)

## Debugging

Enable verbose logging to see entity broadcasts:

```javascript
// Browser console
window.killlistUpdates.handleEntityUpdate({
  entityType: "character",
  id: 123456,
  name: "Test Character"
});
```

Backend logging:
```
[EntityBroadcast] Sent character:123456 = "Test Character"
```

## Performance Considerations

- Entity updates are broadcast asynchronously without blocking main thread
- Frontend uses CSS transitions (GPU-accelerated) for smooth fade-in
- Data attributes are light-weight and don't impact DOM performance
- WebSocket broadcasting is efficient (single iteration over connected clients)
