# Status API

## System Status

### `GET /api/status`

Returns comprehensive system status including database, queue, Redis, WebSocket, and system metrics.

This endpoint provides real-time health information about all system components.

#### Response 200 - Success

```json
{
  "timestamp": "2025-12-01T12:34:56.789Z",
  "database": {
    "tables": [
      {
        "name": "killmails",
        "count": 15234567,
        "size": "42 GB"
      },
      {
        "name": "characters",
        "count": 1234567,
        "size": "256 MB"
      },
      {
        "name": "corporations",
        "count": 456789,
        "size": "128 MB"
      },
      {
        "name": "alliances",
        "count": 3456,
        "size": "8 MB"
      },
      {
        "name": "attackers",
        "count": 45678901,
        "size": "18 GB"
      },
      {
        "name": "items",
        "count": 123456789,
        "size": "35 GB"
      },
      {
        "name": "prices",
        "count": 34567,
        "size": "12 MB"
      },
      {
        "name": "types",
        "count": 34567,
        "size": "45 MB"
      },
      {
        "name": "solarsystems",
        "count": 8285,
        "size": "2 MB"
      }
    ],
    "recentKillmails24h": 12345,
    "activeConnections": 15,
    "databaseSize": "125 GB",
    "killmailsRelatedSize": "95 GB"
  },
  "queues": {
    "character": {
      "active": 5,
      "waiting": 234,
      "prioritized": 0,
      "completed": 1234567,
      "failed": 42,
      "delayed": 0
    },
    "corporation": {
      "active": 3,
      "waiting": 156,
      "prioritized": 0,
      "completed": 456789,
      "failed": 12,
      "delayed": 0
    },
    "alliance": {
      "active": 1,
      "waiting": 23,
      "prioritized": 0,
      "completed": 3456,
      "failed": 2,
      "delayed": 0
    },
    "killmail": {
      "active": 10,
      "waiting": 1234,
      "prioritized": 0,
      "completed": 15234567,
      "failed": 234,
      "delayed": 0
    },
    "price": {
      "active": 2,
      "waiting": 45,
      "prioritized": 0,
      "completed": 34567,
      "failed": 5,
      "delayed": 0
    }
  },
  "redis": {
    "connected": true,
    "usedMemory": "256 MB",
    "keys": 12345,
    "uptime": 864000
  },
  "websocket": {
    "connectedClients": 42,
    "available": true
  },
  "system": {
    "uptimeSeconds": 2592000,
    "memory": {
      "rssMb": 512.5,
      "heapUsedMb": 234.8,
      "heapTotalMb": 456.2
    }
  }
}
```

---

## Status Fields Description

### Database

- **tables**: List of key database tables with row counts and sizes
- **recentKillmails24h**: Number of killmails received in the last 24 hours
- **activeConnections**: Current active PostgreSQL connections
- **databaseSize**: Total database size
- **killmailsRelatedSize**: Combined size of killmail-related tables

### Queues

Queue statistics for each BullMQ queue:

- **active**: Jobs currently being processed
- **waiting**: Jobs waiting to be processed
- **prioritized**: High-priority jobs
- **completed**: Total completed jobs
- **failed**: Total failed jobs
- **delayed**: Jobs scheduled for future execution

### Redis

- **connected**: Redis connection status
- **usedMemory**: Current Redis memory usage
- **keys**: Number of keys in Redis
- **uptime**: Redis server uptime in seconds

### WebSocket

- **connectedClients**: Number of active WebSocket connections
- **available**: WebSocket service availability

### System

- **uptimeSeconds**: Application uptime in seconds
- **memory**: Node.js process memory statistics
  - **rssMb**: Resident Set Size (total memory)
  - **heapUsedMb**: Used heap memory
  - **heapTotalMb**: Total heap memory

---

## Usage Notes

- This endpoint is cached with `private, no-store, max-age=0` headers
- Useful for monitoring and health checks
- Data is collected in real-time on each request
- Queue statistics come from BullMQ Redis state
- Database statistics use PostgreSQL system catalogs for performance
