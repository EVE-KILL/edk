(function () {
  const listeners = new Map(); // message type -> Set<handler>
  const DEFAULT_PORT = 3002;

  function resolveUrl() {
    if (window.__EDK_WS_URL) {
      const base = window.__EDK_WS_URL;
      if (base.includes('/ws')) return base;
      return `${base.replace(/\/$/, '')}/ws`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:${DEFAULT_PORT}/ws`;
  }

  // --- SharedWorker client -------------------------------------------------
  function createWorkerClient() {
    const worker = new SharedWorker('/site-ws-worker.js', { name: 'edk-ws' });
    const port = worker.port;

    let lastTopics = [];
    let connected = false;

    // Set up message handler BEFORE calling port.start()
    port.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      switch (msg.type) {
        case 'worker-ready':
          console.info('[EDK WS] SharedWorker ready');
          window.dispatchEvent(new CustomEvent('edk-ws-ready'));
          break;
        case 'ws-open':
          connected = true;
          updateDebugConnection(true, msg.url);
          break;
        case 'ws-close':
          connected = false;
          updateDebugConnection(false);
          break;
        case 'ws-reconnect':
          updateDebugReconnect(msg.attempts);
          break;
        case 'topics':
          lastTopics = msg.topics || [];
          updateDebugTopics(lastTopics);
          break;
        case 'ws-message':
          dispatch(msg.message);
          break;
        case 'debug-state':
          dispatch(msg);
          break;
        case 'ws-error':
          console.warn('[EDK WS worker] error', msg.error);
          break;
      }
    };

    // Start the port and send init message AFTER handler is set up
    port.start();

    // Provide WS URL hint if set
    if (window.__EDK_WS_URL) {
      port.postMessage({ type: 'init', wsUrl: window.__EDK_WS_URL });
    }

    function on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      return () => {
        const set = listeners.get(type);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) listeners.delete(type);
      };
    }

    function setTopics(namespace, topics) {
      port.postMessage({ type: 'subscribeNamespace', namespace, topics });
      return () => {
        port.postMessage({ type: 'unsubscribeNamespace', namespace });
      };
    }

    function clearTopics(namespace) {
      port.postMessage({ type: 'unsubscribeNamespace', namespace });
    }

    function send(payload) {
      port.postMessage({ type: 'send', payload });
      return true;
    }

    function getStatus() {
      return {
        connected,
        desiredTopics: lastTopics,
      };
    }

    function requestDebugState() {
      port.postMessage({ type: 'debug-request' });
    }

    return { on, setTopics, clearTopics, send, getStatus, requestDebugState };
  }

  // --- Direct client fallback ---------------------------------------------
  function createDirectClient() {
    // Lazy load the previous direct implementation if SharedWorker is missing.
    // Minimal: only supports subscription forwarding for pages that depend on it.
    const wsUrl = resolveUrl();
    console.warn('[EDK WS] SharedWorker unavailable, using direct socket', wsUrl);
    const socket = new WebSocket(wsUrl);
    let connected = false;
    let lastTopics = [];

    socket.onopen = () => {
      connected = true;
      updateDebugConnection(true, wsUrl);
    };
    socket.onclose = () => {
      connected = false;
      updateDebugConnection(false);
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        dispatch(message);
        // Surface as debug worker state in the panel
        if (message.type === 'subscribed' || message.type === 'unsubscribed') {
          updateDebugTopics(message.topics || []);
        }
      } catch (err) {
        console.warn('[EDK WS] fallback parse error', err);
      }
    };

    function on(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
      return () => {
        const set = listeners.get(type);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) listeners.delete(type);
      };
    }

    function setTopics(namespace, topics) {
      socket.send(JSON.stringify({ type: 'subscribe', topics }));
      lastTopics = topics;
      updateDebugTopics(topics);
      return () => {
        socket.send(JSON.stringify({ type: 'unsubscribe', topics }));
      };
    }

    function clearTopics(namespace) {
      // no-op
    }

    function send(payload) {
      socket.send(JSON.stringify(payload));
      return true;
    }

    function getStatus() {
      return {
        connected,
        desiredTopics: lastTopics,
      };
    }

    window.dispatchEvent(new CustomEvent('edk-ws-ready'));
    return { on, setTopics, clearTopics, send, getStatus };
  }

  function dispatch(message) {
    if (!message || !message.type) return;

    // Handle debug-state specially - update state but don't show in recent messages
    if (message.type === 'debug-state') {
      if (window.debugWS) {
        window.debugWS.setWorkerState(message.payload);
      }
      return;
    }

    // Add message to debug UI (will be filtered in addMessage if needed)
    if (window.debugWS) {
      window.debugWS.addMessage(message.type, message);
    }

    // Dispatch to type-specific handlers
    const handlers = listeners.get(message.type);
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        try {
          handler(message);
        } catch (error) {
          console.error('[EDK WS] Handler failed', error);
        }
      }
    }

    // Dispatch to wildcard handlers
    const anyHandlers = listeners.get('*');
    if (anyHandlers) {
      for (const handler of Array.from(anyHandlers)) {
        try {
          handler(message);
        } catch (error) {
          console.error('[EDK WS] Handler failed', error);
        }
      }
    }
  }

  function updateDebugConnection(isConnected, url) {
    if (!window.debugWS) return;
    window.debugWS.enable();
    window.debugWS.setConnected(isConnected, url);
    window.debugWS.addMessage(isConnected ? 'ws-open' : 'ws-close', { url });
  }

  function updateDebugReconnect(attempts) {
    if (!window.debugWS) return;
    window.debugWS.setReconnectCount(attempts);
    window.debugWS.addMessage('ws-reconnect', { attempts });
  }

  function updateDebugTopics(topics) {
    if (!window.debugWS) return;
    window.debugWS.setTopics(topics || []);
  }

  let client;
  try {
    if (typeof SharedWorker !== 'undefined') {
      client = createWorkerClient();
    }
  } catch (err) {
    console.warn('[EDK WS] SharedWorker unavailable, falling back', err);
  }
  if (!client) {
    client = createDirectClient();
  }

  window.__edkWS = client;
  if (!window.__edkWS) {
    console.warn('[EDK WS] Failed to initialize websocket client');
  }
  // Request an early debug snapshot once client is ready
  try {
    if (window.__edkWS.requestDebugState) {
      window.__edkWS.requestDebugState();
    }
  } catch {
    // ignore
  }
})();
