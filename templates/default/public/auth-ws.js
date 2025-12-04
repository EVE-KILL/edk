(function () {
  let ws;

  function startWS(clientId) {
    const wsUrl =
      (window.__EDK_WS_URL || 'wss://ws.eve-kill.com/ws') + `?cid=${clientId}`;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {};
      ws.onclose = () => {
        ws = null;
      };
      ws.onmessage = (evt) => {
        // Handle direct messages here if desired
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'direct') {
            console.log('[WS direct]', msg.data);
          }
        } catch (err) {
          console.warn('WS message parse error', err);
        }
      };
    } catch (err) {
      console.warn('WS connect failed', err);
    }
  }

  window.__EDK_START_WS = (clientId) => {
    if (ws || !clientId) return;
    startWS(clientId);
  };
})();
