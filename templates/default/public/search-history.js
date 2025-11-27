// Search History Module
// Manages a unified search history in localStorage.

(function (exports) {
  'use strict';

  const STORAGE_KEY = 'unifiedSearchHistory';
  const MAX_HISTORY_ITEMS = 7;

  /**
   * Retrieves the search history from localStorage.
   * @returns {string[]} An array of search history terms.
   */
  function getHistory() {
    try {
      const storedHistory = localStorage.getItem(STORAGE_KEY);
      return storedHistory ? JSON.parse(storedHistory) : [];
    } catch (error) {
      console.error('[SearchHistory] Error getting history:', error);
      return [];
    }
  }

  /**
   * Saves the search history to localStorage.
   * @param {string[]} history - The array of search terms to save.
   */
  function saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('[SearchHistory] Error saving history:', error);
    }
  }

  /**
   * Adds a new term to the search history.
   * The term is added to the top, and duplicates are removed.
   * The history is capped at MAX_HISTORY_ITEMS.
   * @param {string} term - The search term to add.
   */
  function addHistory(term) {
    if (!term || typeof term !== 'string' || term.trim().length === 0) {
      return;
    }

    let history = getHistory();

    // Remove any existing instances of the term to avoid duplicates
    history = history.filter(item => item.toLowerCase() !== term.toLowerCase());

    // Add the new term to the beginning of the array
    history.unshift(term);

    // Trim the history to the maximum allowed length
    if (history.length > MAX_HISTORY_ITEMS) {
      history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    saveHistory(history);
  }

  /**
   * Clears the entire search history.
   */
  function clearHistory() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[SearchHistory] Error clearing history:', error);
    }
  }

  // Expose the public API
  exports.SearchHistory = {
    get: getHistory,
    add: addHistory,
    clear: clearHistory,
  };

})(window);
