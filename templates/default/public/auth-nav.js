// Authentication Navigation
// Handles dynamic auth UI updates in navigation bar

(function () {
  'use strict';

  // Wait for auth state to be available
  window.addEventListener('auth-ready', () => {
    // Auth UI updates will be handled by auth-state.js
    console.log('[auth-nav] Ready');
  });
})();
