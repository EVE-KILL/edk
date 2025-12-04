/**
 * Development Hot Reload Client
 * Connects to WebSocket server and reloads page on template/server changes
 * Only active in development mode
 */
(function () {
  'use strict';

  console.log('[DEV-RELOAD] Script loaded! WS_URL:', window.__EDK_WS_URL);

  // Only run in development
  if (!window.__EDK_WS_URL) {
    console.error(
      '[DEV-RELOAD] ❌ WebSocket URL not configured, skipping hot reload'
    );
    return;
  }

  console.log('[DEV-RELOAD] ✅ Initializing hot reload...');

  let ws = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_DELAY = 2000;

  function connect() {
    console.log('[DEV-RELOAD] Attempting to connect to:', window.__EDK_WS_URL);
    try {
      ws = new WebSocket(window.__EDK_WS_URL);
      console.log('[DEV-RELOAD] WebSocket object created');

      ws.addEventListener('open', function () {
        console.log('[DEV-RELOAD] 🔄 Hot reload connected successfully!');
        reconnectAttempts = 0;
      });

      ws.addEventListener('message', function (event) {
        try {
          const message = JSON.parse(event.data);

          // ONLY handle direct messages with reload types - ignore killmails
          if (message.type === 'direct' && message.data) {
            const dataType = message.data.type;

            // Only process server-reload and template-reload messages
            if (
              dataType === 'server-reload' ||
              dataType === 'template-reload'
            ) {
              const filename = message.data.filename;

              if (dataType === 'server-reload') {
                console.log(
                  '[DEV-RELOAD] 🔄 Server restarted - reloading page...'
                );
              } else if (dataType === 'template-reload') {
                console.log(
                  `[DEV-RELOAD] 📝 Template changed: ${filename || 'unknown'} - reloading page...`
                );
              }

              // Save scroll position before reload
              sessionStorage.setItem(
                'dev-reload-scroll',
                window.scrollY.toString()
              );
              setTimeout(() => window.location.reload(), 100);
            }
            // Silently ignore other direct message types
          }
          // Silently ignore killmail and other message types
        } catch (error) {
          console.error('[DEV-RELOAD] Error parsing message:', error);
        }
      });

      ws.addEventListener('close', function () {
        console.log(
          '[DEV-RELOAD] ⚠️  Connection closed - attempting reconnect...'
        );
        ws = null;
        attemptReconnect();
      });

      ws.addEventListener('error', function (error) {
        console.error('[DEV-RELOAD] ❌ WebSocket error:', error);
      });
    } catch (error) {
      console.error('[DEV-RELOAD] Failed to connect:', error);
      attemptReconnect();
    }
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[DEV-RELOAD] Max reconnect attempts reached - giving up');
      return;
    }

    reconnectAttempts++;
    console.log(
      `[DEV-RELOAD] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
    );

    setTimeout(connect, RECONNECT_DELAY);
  }

  // Restore scroll position after reload
  window.addEventListener('DOMContentLoaded', function () {
    const savedScroll = sessionStorage.getItem('dev-reload-scroll');
    if (savedScroll !== null) {
      console.log('[DEV-RELOAD] Restoring scroll position:', savedScroll);
      window.scrollTo(0, parseInt(savedScroll, 10));
      sessionStorage.removeItem('dev-reload-scroll');
    }
  });

  // Start connection
  connect();

  // Cleanup on page unload
  window.addEventListener('beforeunload', function () {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
})();
