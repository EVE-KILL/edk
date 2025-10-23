# Event System Architecture# Event System Architecture



## Overview## Overview



EDK uses an internal event system to communicate between separate processes:EDK uses an internal event system to communicate between separate processes:



- **Web Server** (`:3000`) - Handles HTTP requests and WebSocket connections- **Web Server** (`:3000`) - Handles HTTP requests and WebSocket connections

- **Management API** (`:3001`) - Internal-only HTTP API for events  - **Management API** (`:3001`) - Internal-only HTTP API for events

- **Queue Workers** - Background job processing- **Queue Workers** - Background job processing

- **RedisQ Listener** - Real-time killmail ingestion- **RedisQ Listener** - Real-time killmail ingestion



## How It Works## Architecture



Queue workers run in separate processes and cannot access the web server's in-memory WebSocket manager. The solution is a lightweight internal HTTP API on localhost:```

┌─────────────────────────────────────────────────────────┐

1. Queue worker processes killmail│                    Queue Workers                         │

2. Sends HTTP POST to `127.0.0.1:3001/events`│  (separate process: bun cli queue:work)                 │

3. Management API broadcasts to WebSocket clients│                                                         │

4. Browser clients receive real-time updates│  sendEvent("killmail", {...})                          │

│          │                                              │

## Using the Event System│          └──► POST http://127.0.0.1:3001/events        │

└─────────────────────────────────────────────────────────┘

### From Queue Workers                         │

                         ▼

```typescript┌─────────────────────────────────────────────────────────┐

import { sendEvent } from "../../src/utils/event-client";│            Management API Server :3001                  │

│       (started by main web server process)              │

// Send an event│                                                         │

await sendEvent("killmail", {│  - Receives events from queue workers                  │

  killmailId: 123456,│  - Validates event payloads                            │

  timestamp: new Date(),│  - Broadcasts to WebSocket manager                     │

});└─────────────────────────────────────────────────────────┘

                         │

// With retry logic (3 attempts, exponential backoff)                         ▼

import { sendEventWithRetry } from "../../src/utils/event-client";┌─────────────────────────────────────────────────────────┐

│              WebSocket Manager (in-memory)              │

await sendEventWithRetry("critical-event", data, 3, 100);│        Maintains connections to browser clients         │

```│                                                         │

│  - Tracks connected WebSocket clients                  │

## Event Types│  - Broadcasts events to all clients                    │

└─────────────────────────────────────────────────────────┘

### killmail                         │

                         ▼

Sent when a new killmail has been fetched and processed.┌─────────────────────────────────────────────────────────┐

│             Browser WebSocket Clients                   │

Payload:│              (connect to :3000/updates)                │

│                                                         │

```typescript│  - Receive real-time updates                           │

{│  - Update UI with new data                             │

  killmailId: number;└─────────────────────────────────────────────────────────┘

  timestamp: Date;```

  victimId: number;

  victimCorporationId: number;## Event Flow

  victimAllianceId: number;

  systemId: number;1. **Queue worker processes a killmail**

  shipTypeId: number;

  attackerCount: number;```typescript

}await sendEvent("killmail", {

```  killmailId: 123456,

  victimId: 2112625428,

## Security  // ... more data

});

- Management API only accepts connections from `127.0.0.1````

- WebSocket only accepts connections from localhost

- All external connections are rejected immediately2. **Event client sends HTTP POST to management API**

- Events must have a `type` field (validated server-side)

```

## ConfigurationPOST http://127.0.0.1:3001/events

Content-Type: application/json

Environment variables (optional):

{

```bash  "type": "killmail",

MANAGEMENT_API_URL=http://127.0.0.1:3001  "data": { ... }

MANAGEMENT_API_PORT=3001}

``````



## Testing Locally3. **Management API validates and broadcasts**

   - Validates event has `type` field

Terminal 1 - Start web server:   - Calls `webSocketManager.broadcast(type, data)`

   - Returns `{ success: true }`

```bash

bun run dev4. **WebSocket manager sends to all clients**

```   - Sends JSON message to each connected client

   - Each client receives:

Terminal 2 - Send test event:

```json

```bash{

curl -X POST http://127.0.0.1:3001/events \  "type": "killmail",

  -H "Content-Type: application/json" \  "data": { ... },

  -d '{"type":"test","data":{"message":"Hello"}}'  "timestamp": 1697962000000

```}

```

Terminal 3 - Browser console:

## Security

```javascript

const ws = new WebSocket('ws://localhost:3000/updates');### Connection Control

ws.addEventListener('message', e => console.log(JSON.parse(e.data)));

```- **Management API**: Only accepts connections from `127.0.0.1` (localhost)

- **WebSocket**: Also validates only internal connections

You should see the test event arrive immediately!- Both reject external/remote connections immediately


### Event Validation

- Events must have a `type` field
- Invalid payloads return 400 Bad Request
- Malformed JSON returns 400 Bad Request

## Using the Event System

### From Queue Workers

```typescript
import { sendEvent } from "../../src/utils/event-client";

// Send an event
await sendEvent("killmail", {
  killmailId: 123456,
  timestamp: new Date(),
  // ... event-specific data
});

// With retry logic for critical events
import { sendEventWithRetry } from "../../src/utils/event-client";

await sendEventWithRetry("critical-event", data, 3, 100);
```

### Configuration

Set the management API URL via environment variable (optional):

```bash
# Default: http://127.0.0.1:3001
MANAGEMENT_API_URL=http://127.0.0.1:3001

# Default: 3001
MANAGEMENT_API_PORT=3001
```

## Event Types

### killmail

Sent when a new killmail has been fetched and processed.

**Payload:**
```typescript
{
  killmailId: number;
  timestamp: Date;
  victimId: number;
  victimCorporationId: number;
  victimAllianceId: number;
  systemId: number;
  shipTypeId: number;
  attackerCount: number;
}
```

### Future Event Types

More event types can be added in the future:
- `statistics` - Statistics updates
- `entity-activity` - Character/Corp/Alliance activity
- `price-update` - Item price changes
- `cache-cleared` - Cache invalidation events
- etc.

## Performance

- **Latency**: < 10ms typically (localhost HTTP)
- **Throughput**: Can handle thousands of events per second
- **Memory**: One HTTP request per event (no persistence)
- **Reliability**: Best-effort delivery (events are not retried by default)

## Troubleshooting

### Events not reaching clients?

1. Check management server is running: `curl http://127.0.0.1:3001/events`
   - Should return `404 Not found` (POST only) ✓
   - If connection refused, check `MANAGEMENT_API_PORT`

2. Check WebSocket connections:
   - Browser console: `new WebSocket('ws://localhost:3000/updates')`
   - Should connect without errors

3. Enable verbose logging:
   ```bash
   VERBOSE_MODE=1 bun run dev
   ```

### How to test locally?

```bash
# Terminal 1: Start web server
bun run dev

# Terminal 2: Send test event
curl -X POST http://127.0.0.1:3001/events \
  -H "Content-Type: application/json" \
  -d '{"type":"test","data":{"message":"Hello"}}'

# Terminal 3: Browser console
const ws = new WebSocket('ws://localhost:3000/updates');
ws.addEventListener('message', e => console.log(JSON.parse(e.data)));
```

You should see the test event arrive in the browser console!
