// SharedWorker that owns the single websocket connection for the site.
// Each page connects via a MessagePort and asks for topic subscriptions.
// The worker keeps the socket alive as long as any port is connected.

const DEFAULT_PORT = 3002;
const INITIAL_BACKOFF = 1000;
const MAX_BACKOFF = 30000;
const BASE_TOPICS = new Set(); // Add global topics here when available

/** @type {Set<MessagePort>} */
const ports = new Set();
/** @type {Map<MessagePort, Map<string, Set<string>>>} */
const portNamespaces = new Map();
let socket = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let backoff = INITIAL_BACKOFF;
let wsUrlOverride = null;
let currentTopics = new Set(BASE_TOPICS);
let lastError = null;
let lastClose = null;
let connectedAt = null;

function resolveUrl() {
  if (wsUrlOverride) {
    const base = wsUrlOverride;
    if (base.includes('/ws')) return base;
    return `${base.replace(/\/$/, '')}/ws`;
  }
  const protocol = self.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${self.location.hostname}:${DEFAULT_PORT}/ws`;
}

function computeDesiredTopics() {
  const merged = new Set(BASE_TOPICS);
  for (const nsMap of portNamespaces.values()) {
    for (const topicSet of nsMap.values()) {
      for (const topic of topicSet) merged.add(topic);
    }
  }
  return merged;
}

function broadcast(payload) {
  for (const port of Array.from(ports)) {
    try {
      port.postMessage(payload);
    } catch (error) {
      // If a port is dead, drop it so we don't leak topics
      ports.delete(port);
      portNamespaces.delete(port);
    }
  }
}

function syncSubscriptions(forceFull = false) {
  const desired = computeDesiredTopics();

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    broadcast({ type: 'topics', topics: Array.from(desired) });
    return;
  }

  const toUnsubscribe = forceFull
    ? Array.from(currentTopics).filter((topic) => !desired.has(topic))
    : Array.from(currentTopics).filter((topic) => !desired.has(topic));
  const toSubscribe = forceFull
    ? Array.from(desired)
    : Array.from(desired).filter((topic) => !currentTopics.has(topic));

  if (toUnsubscribe.length) {
    try {
      socket.send(JSON.stringify({ type: 'unsubscribe', topics: toUnsubscribe }));
    } catch {}
  }
  if (toSubscribe.length) {
    try {
      socket.send(JSON.stringify({ type: 'subscribe', topics: toSubscribe }));
    } catch {}
  }

  currentTopics = new Set(desired);
  broadcast({ type: 'topics', topics: Array.from(desired) });
}

function connect() {
  const url = resolveUrl();
  socket = new WebSocket(url);

  socket.onopen = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;
    backoff = INITIAL_BACKOFF;
    currentTopics = new Set(BASE_TOPICS);
    connectedAt = Date.now();
    broadcast({
      type: 'ws-open',
      url,
      connectedAt,
      reconnectAttempts,
    });
    syncSubscriptions(true);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
        broadcast({ type: 'ws-ping' });
        return;
      }
      if (message.type === 'subscribed' && Array.isArray(message.topics)) {
        message.topics.forEach((topic) => currentTopics.add(topic));
        broadcast({ type: 'topics', topics: Array.from(currentTopics) });
      }
      if (message.type === 'unsubscribed' && Array.isArray(message.topics)) {
        message.topics.forEach((topic) => currentTopics.delete(topic));
        broadcast({ type: 'topics', topics: Array.from(currentTopics) });
      }
      broadcast({ type: 'ws-message', message });
    } catch (error) {
      broadcast({ type: 'ws-error', error: error?.message || String(error) });
    }
  };

  socket.onclose = (event) => {
      broadcast({ type: 'ws-close', code: event.code, reason: event.reason });
    lastClose = { code: event.code, reason: event.reason, at: Date.now() };
    scheduleReconnect();
  };

  socket.onerror = (error) => {
    lastError = { error: error?.message || String(error), at: Date.now() };
    broadcast({ type: 'ws-error', error: error?.message || String(error) });
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempts += 1;
    broadcast({ type: 'ws-reconnect', attempts: reconnectAttempts });
    connect();
  }, backoff);
  backoff = Math.min(backoff * 2, MAX_BACKOFF);
}

function setPortTopics(port, namespace, topics) {
  if (!namespace) namespace = 'default';
  if (!Array.isArray(topics) || topics.length === 0) return;

  let nsMap = portNamespaces.get(port);
  if (!nsMap) {
    nsMap = new Map();
    portNamespaces.set(port, nsMap);
  }
  nsMap.set(namespace, new Set(topics.map((t) => String(t))));
  syncSubscriptions();
}

function clearPortNamespace(port, namespace) {
  const nsMap = portNamespaces.get(port);
  if (!nsMap) return;
  nsMap.delete(namespace || 'default');
  if (nsMap.size === 0) {
    portNamespaces.delete(port);
  }
  syncSubscriptions();
}

function removePort(port) {
  ports.delete(port);
  portNamespaces.delete(port);
  syncSubscriptions();
}

function handlePortMessage(port, data) {
  if (!data || typeof data !== 'object') return;
  switch (data.type) {
    case 'init':
      if (data.wsUrl) {
        wsUrlOverride = data.wsUrl;
      }
      syncSubscriptions();
      break;
    case 'debug-request':
      port.postMessage({
        type: 'debug-state',
        payload: {
          url: resolveUrl(),
          connected: socket?.readyState === WebSocket.OPEN,
          reconnectAttempts,
          backoff,
          connectedAt,
          lastError,
          lastClose,
          topics: Array.from(currentTopics),
          portCount: ports.size,
        },
      });
      break;
    case 'subscribeNamespace':
      setPortTopics(port, data.namespace, data.topics);
      break;
    case 'unsubscribeNamespace':
      clearPortNamespace(port, data.namespace);
      break;
    case 'disconnect':
      removePort(port);
      break;
    case 'send':
      if (socket && socket.readyState === WebSocket.OPEN && data.payload) {
        try {
          socket.send(JSON.stringify(data.payload));
        } catch {}
      }
      break;
  }
}

self.onconnect = (event) => {
  const port = event.ports[0];
  ports.add(port);
  port.start();
  port.postMessage({ type: 'worker-ready' });
  // Send initial debug snapshot so the panel shows state immediately
  port.postMessage({
    type: 'debug-state',
    payload: {
      url: resolveUrl(),
      connected: socket?.readyState === WebSocket.OPEN,
      reconnectAttempts,
      backoff,
      connectedAt,
      lastError,
      lastClose,
      topics: Array.from(currentTopics),
      portCount: ports.size,
    },
  });
  port.onmessage = (ev) => handlePortMessage(port, ev.data);
  port.onmessageerror = () => removePort(port);
};

connect();
