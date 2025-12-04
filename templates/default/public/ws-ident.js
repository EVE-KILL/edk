(function () {
  const COOKIE_NAME = 'edk_ws_id';
  function getCookie(name) {
    return document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(name + '='))
      ?.split('=')[1];
  }
  function setCookie(name, value) {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  }
  function uuid() {
    return (
      (crypto.randomUUID && crypto.randomUUID()) ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      })
    );
  }

  let id = getCookie(COOKIE_NAME);
  if (!id) {
    id = uuid();
    setCookie(COOKIE_NAME, id);
  }

  window.__EDK_WS_ID = id;
})();
