// Search functionality
// Handles search bar interactions and API calls

(function () {
  'use strict';

  let searchTimeout = null;
  let currentResults = [];
  let selectedIndex = -1;

  // Initialize search functionality
  document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput || !searchResults) return;

    // Handle input
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      // Clear timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      // Hide results if query is too short
      if (query.length < 2) {
        hideResults();
        return;
      }

      // Debounce search
      searchTimeout = setTimeout(() => {
        performSearch(query);
      }, 200);
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      if (!searchResults.classList.contains('active')) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
          updateSelection();
          break;
        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          updateSelection();
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && currentResults[selectedIndex]) {
            navigateToResult(currentResults[selectedIndex]);
          }
          break;
        case 'Escape':
          hideResults();
          break;
      }
    });

    // Handle blur
    searchInput.addEventListener('blur', () => {
      // Delay to allow click on results
      setTimeout(() => hideResults(), 200);
    });

    // Handle focus
    searchInput.addEventListener('focus', () => {
      if (currentResults.length > 0) {
        showResults();
      }
    });

    async function performSearch(query) {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
        const data = await response.json();
        
        currentResults = data.results || [];
        selectedIndex = -1;
        
        if (currentResults.length > 0) {
          renderResults(currentResults);
          showResults();
        } else {
          renderNoResults();
          showResults();
        }
      } catch (error) {
        console.error('[search] Error:', error);
        hideResults();
      }
    }

    function renderResults(results) {
      // Group by type
      const grouped = {};
      results.forEach(result => {
        if (!grouped[result.type]) grouped[result.type] = [];
        grouped[result.type].push(result);
      });

      let html = '';
      
      // Type order and labels
      const typeOrder = [
        { key: 'character', label: 'Characters', icon: '👤' },
        { key: 'corporation', label: 'Corporations', icon: '🏢' },
        { key: 'alliance', label: 'Alliances', icon: '🛡️' },
        { key: 'system', label: 'Systems', icon: '🌟' },
        { key: 'constellation', label: 'Constellations', icon: '🌌' },
        { key: 'region', label: 'Regions', icon: '🗺️' },
        { key: 'item', label: 'Items', icon: '📦' }
      ];

      typeOrder.forEach(({ key, label, icon }) => {
        if (grouped[key] && grouped[key].length > 0) {
          html += `<div class="search-group">`;
          html += `<div class="search-group-label">${icon} ${label}</div>`;
          grouped[key].forEach(result => {
            const resultIndex = results.indexOf(result);
            html += `
              <div class="search-result-item" data-index="${resultIndex}" onclick="window.location.href='${getResultUrl(result)}'">
                <div class="search-result-name">${escapeHtml(result.name)}</div>
                <div class="search-result-type">${result.type}</div>
              </div>
            `;
          });
          html += `</div>`;
        }
      });

      searchResults.innerHTML = html;
    }

    function renderNoResults() {
      searchResults.innerHTML = `
        <div class="search-no-results">
          No results found
        </div>
      `;
    }

    function updateSelection() {
      const items = searchResults.querySelectorAll('.search-result-item');
      items.forEach((item, index) => {
        if (index === selectedIndex) {
          item.classList.add('selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('selected');
        }
      });
    }

    function navigateToResult(result) {
      window.location.href = getResultUrl(result);
    }

    function getResultUrl(result) {
      switch (result.type) {
        case 'character':
          return `/character/${result.id}`;
        case 'corporation':
          return `/corporation/${result.id}`;
        case 'alliance':
          return `/alliance/${result.id}`;
        case 'system':
          return `/system/${result.id}`;
        case 'constellation':
          return `/constellation/${result.id}`;
        case 'region':
          return `/region/${result.id}`;
        case 'item':
          return `/item/${result.id}`;
        default:
          return '#';
      }
    }

    function showResults() {
      searchResults.classList.add('active');
    }

    function hideResults() {
      searchResults.classList.remove('active');
      currentResults = [];
      selectedIndex = -1;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    console.log('[search] Ready');
  });
})();
