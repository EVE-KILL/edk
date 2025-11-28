# WebSocket API

EVE-KILL provides real-time killmail streaming via WebSocket.

## Connection

Connect to the WebSocket endpoint:

```javascript
const ws = new WebSocket('wss://yourdomain.com/ws');

ws.onopen = () => {
  console.log('Connected to EVE-KILL');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

## Message Types

### Killmail

New killmail notification:

```json
{
  "type": "killmail",
  "data": {
    "killmailId": 12345678,
    "killmailTime": "2024-01-15T14:30:00Z",
    "totalValue": 1500000000,
    "victim": {
      "characterId": 123456,
      "characterName": "Victim Name",
      "corporationId": 98000001,
      "corporationName": "Corp Name",
      "shipTypeId": 17740,
      "shipName": "Machariel"
    },
    "solarSystem": {
      "solarSystemId": 30002187,
      "solarSystemName": "Jita",
      "security": 1.0
    },
    "attackerCount": 5
  }
}
```

### Ping/Pong

Keep-alive messages:

```json
{
  "type": "ping"
}
```

Respond with:

```json
{
  "type": "pong"
}
```

## Subscriptions

By default, all killmails are received. Subscribe to specific filters:

### Subscribe to Entity

```json
{
  "action": "subscribe",
  "channel": "character",
  "id": 123456
}
```

Channels: `character`, `corporation`, `alliance`, `system`, `region`

### Unsubscribe

```json
{
  "action": "unsubscribe",
  "channel": "character",
  "id": 123456
}
```

### Subscribe to High Value Only

```json
{
  "action": "subscribe",
  "channel": "highvalue",
  "minValue": 1000000000
}
```

## Client Example

Complete JavaScript client:

```javascript
class EVEKillSocket {
  constructor(url = 'wss://yourdomain.com/ws') {
    this.url = url;
    this.ws = null;
    this.handlers = new Map();
    this.reconnectDelay = 1000;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('Connected');
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'ping') {
        this.ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      const handler = this.handlers.get(msg.type);
      if (handler) handler(msg.data);
    };

    this.ws.onclose = () => {
      console.log('Disconnected, reconnecting...');
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
    };
  }

  on(type, handler) {
    this.handlers.set(type, handler);
  }

  subscribe(channel, id) {
    this.ws.send(
      JSON.stringify({
        action: 'subscribe',
        channel,
        id,
      })
    );
  }
}

// Usage
const socket = new EVEKillSocket();
socket.on('killmail', (km) => console.log('New kill:', km));
socket.connect();
```

## Rate Limits

- Maximum 5 connections per IP
- Messages limited to 100/minute
- Subscriptions limited to 50 per connection
