# WebSocket Updates System

## Overview

The EDK system includes a real-time WebSocket endpoint for broadcasting events to connected clients. The endpoint is **server-emits-only**, meaning:

- ✅ Server broadcasts updates to all connected clients
- ❌ Client messages are silently ignored (not processed)
- ✅ Only internal/localhost connections are allowed

## Endpoint

**URL:** `ws://localhost:3000/updates` (or `wss://` for TLS)

## Connection

```javascript
const socket = new WebSocket('ws://localhost:3000/updates');

socket.addEventListener('open', () => {
  console.log('Connected to updates');
});

socket.addEventListener('message', (event) => {
  const update = JSON.parse(event.data);
  console.log('Update received:', update);
});
```

## Update Message Format

All updates follow this format:

```typescript
interface UpdateMessage {
  type: string;          // Type of update (e.g., "killmail")
  data: any;            // Update-specific data
  timestamp: number;    // Unix timestamp when update was sent
}
```

## Update Types

### Killmail Update

Emitted when a new killmail has been fetched and processed.

**Type:** `killmail`

**Data:**

```typescript
{
  killmailId: number;           // EVE Online killmail ID
  timestamp: Date;              // When the update was sent
  victimId: number;             // Character ID of victim
  victimCorporationId: number;  // Corporation ID of victim
  victimAllianceId: number;     // Alliance ID of victim (if any)
  systemId: number;             // Solar system ID where kill occurred
  shipTypeId: number;           // Ship type ID that was destroyed
  attackerCount: number;        // Number of attackers involved
}
```

**Example:**

```json
{
  "type": "killmail",
  "timestamp": 1697962000000,
  "data": {
    "killmailId": 123456789,
    "timestamp": "2024-10-22T10:30:00.000Z",
    "victimId": 2112625428,
    "victimCorporationId": 98765432,
    "victimAllianceId": 99999999,
    "systemId": 30000142,
    "shipTypeId": 587,
    "attackerCount": 15
  }
}
```

## Security

### Connection Validation

The WebSocket only accepts connections from:

- `localhost` (127.0.0.1)
- Internal IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)

Connections from external IPs are rejected immediately.

### Message Handling

All client-sent messages are **silently ignored**. This is intentional:

- Reduces attack surface
- Prevents abuse
- No need for complex message validation
- Clear separation: server emits, clients listen

## Use Cases

1. **Real-time Dashboard:** Update killmail list as new kills arrive
2. **Notifications:** Alert users when their corporation's kill appears
3. **Live Statistics:** Update top 10 boxes in real-time
4. **Monitoring:** External tools can monitor killboard activity
5. **Mobile Apps:** Push updates to companion apps

## Scaling Considerations

- Each connected client is tracked in memory
- Broadcasting is efficient (single iteration over connected clients)
- Backpressure handling: returns -1 if message is enqueued
- Connections timeout after 120 seconds of inactivity (configurable)

## Future Updates

More update types can be added in the future:

- `statistics` - Statistics updates
- `entity-activity` - Character/Corp/Alliance activity
- `price-update` - Item price changes
- `event` - Generic events

To add a new update type:

1. Emit it from relevant workers: `webSocketManager.broadcast("type", data)`
2. Document the format above
3. Clients listen for the type
