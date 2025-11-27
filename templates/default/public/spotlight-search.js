// Spotlight Search - CMD/CTRL + K modal search
// Global keyboard-triggered search interface

(function () {
  'use strict';

  let searchTimeout = null;
  let currentResults = [];
  let selectedIndex = -1;

  // State
  let isOpen = false;
  let searchInput = null;
  let resultsContainer = null;
  let overlay = null;

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    createSpotlightDOM();
    setupKeyboardShortcuts();
    console.log('[spotlight] Ready (Cmd/Ctrl + K to open)');
  });

  function createSpotlightDOM() {
    const html = `
      <div id="spotlightOverlay" class="spotlight-overlay">
        <div class="spotlight-modal" onclick="event.stopPropagation()">
          <div class="spotlight-header">
            <svg class="spotlight-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input type="text" id="spotlightInput" placeholder="Search for anything..." autocomplete="off" />
            <kbd class="spotlight-kbd">ESC</kbd>
          </div>

          <div id="spotlightResults" class="spotlight-results"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    overlay = document.getElementById('spotlightOverlay');
    searchInput = document.getElementById('spotlightInput');
    resultsContainer = document.getElementById('spotlightResults');

    // Event listeners
    overlay.addEventListener('click', closeSpotlight);
    searchInput.addEventListener('input', handleInput);
    searchInput.addEventListener('keydown', handleKeydown);
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();

        // Don't open if typing in input/textarea (except spotlight itself)
        const target = e.target;
        const isTyping = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
                         && target.id !== 'spotlightInput';

        if (!isTyping) {
          toggleSpotlight();
        }
      }

      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        closeSpotlight();
      }
    });
  }

  function toggleSpotlight() {
    if (isOpen) {
      closeSpotlight();
    } else {
      openSpotlight();
    }
  }

  function openSpotlight() {
    isOpen = true;
    overlay.classList.add('active');
    searchInput.value = '';
    searchInput.focus();
    selectedIndex = -1;
    renderEmptyState();
  }

  function closeSpotlight() {
    isOpen = false;
    overlay.classList.remove('active');
    currentResults = [];
    selectedIndex = -1;
  }

  function handleInput(e) {
    const query = e.target.value.trim();

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (query.length < 2) {
      renderEmptyState();
      return;
    }

    // Show loading
    resultsContainer.innerHTML = '<div class="spotlight-loading">Searching...</div>';

    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 200);
  }

  function handleKeydown(e) {
    const hasResults = currentResults.length > 0;

    switch (e.key) {
      case 'ArrowDown':
        if (hasResults) {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
          updateSelection();
        }
        break;
      case 'ArrowUp':
        if (hasResults) {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          updateSelection();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && currentResults[selectedIndex]) {
          navigateToResult(currentResults[selectedIndex]);
        }
        break;
    }
  }

  async function performSearch(query) {
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await response.json();

      currentResults = data.results || [];
      selectedIndex = -1;

      if (currentResults.length > 0) {
        renderResults(currentResults);
      } else {
        renderNoResults(query);
      }
    } catch (error) {
      console.error('[spotlight] Search error:', error);
      resultsContainer.innerHTML = '<div class="spotlight-error">Search failed</div>';
    }
  }

  function renderEmptyState() {
    let html = '<div class="spotlight-empty">';

    // Quick actions
    html += '<div class="spotlight-section">';
    html += '<div class="spotlight-section-title">Quick Actions</div>';
    html += '<div class="spotlight-quick-grid">';
    html += '<a href="/" class="spotlight-quick-item" onclick="event.stopPropagation()">⚡ Latest Kills</a>';
    html += '<a href="/kills/big" class="spotlight-quick-item" onclick="event.stopPropagation()">💰 Big Kills</a>';
    html += '<a href="/statistics" class="spotlight-quick-item" onclick="event.stopPropagation()">📊 Statistics</a>';
    html += '<a href="/entities" class="spotlight-quick-item" onclick="event.stopPropagation()">👥 Entities</a>';
    html += '</div>';
    html += '</div>';

    // Recent searches
    const recentSearches = window.SearchHistory ? window.SearchHistory.get() : [];
    if (recentSearches.length > 0) {
      html += '<div class="spotlight-section">';
      html += '<div class="spotlight-section-title">Recent Searches</div>';
      html += '<div class="spotlight-recent-list">';
      recentSearches.forEach((search) => {
        html += `
          <button class="spotlight-recent-item" onclick="window.spotlightSelectRecent('${escapeHtml(search)}')">
            <span>🕒 ${escapeHtml(search)}</span>
          </button>
        `;
      });
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    resultsContainer.innerHTML = html;
  }

  function renderResults(results) {
    const grouped = results.reduce((acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = [];
      }
      acc[result.type].push(result);
      return acc;
    }, {});

    const typeConfig = {
      killmail: { label: 'Killmails', icon: '💥' },
      character: { label: 'Characters', icon: '👤' },
      corporation: { label: 'Corporations', icon: '🏢' },
      alliance: { label: 'Alliances', icon: '🛡️' },
      system: { label: 'Systems', icon: '🌟' },
      constellation: { label: 'Constellations', icon: '🌌' },
      region: { label: 'Regions', icon: '🗺️' },
      item: { label: 'Items', icon: '📦' }
    };

    let html = '';
    const imageServerUrl = window.__EDK_IMAGE_URL || 'https://images.evetech.net';

    Object.keys(typeConfig).forEach(type => {
      if (grouped[type] && grouped[type].length > 0) {
        const config = typeConfig[type];
        html += `<div class="spotlight-section">`;
        html += `<div class="spotlight-section-title">${config.icon} ${config.label}</div>`;
        html += `<div class="spotlight-grid">`;

        grouped[type].forEach(result => {
          const resultIndex = results.indexOf(result);
          const url = getResultUrl(result);
          const id = result.id || result.rawId;

          let image = '';
          let subtext = '';
          let valueText = '';

          switch (type) {
            case 'character':
              image = `<img src="${imageServerUrl}/characters/${id}/portrait?size=128" alt="${escapeHtml(result.name)}" class="spotlight-card__image spotlight-card__image--char" loading="lazy" onerror="this.style.display='none'">`;
              subtext = result.corporationName || 'No Corporation';
              if (result.allianceName) subtext += ` / ${result.allianceName}`;
              break;
            case 'corporation':
              image = `<img src="${imageServerUrl}/corporations/${id}/logo?size=128" alt="${escapeHtml(result.name)}" class="spotlight-card__image" loading="lazy" onerror="this.style.display='none'">`;
              subtext = result.allianceName || 'No Alliance';
              break;
            case 'alliance':
              image = `<img src="${imageServerUrl}/alliances/${id}/logo?size=128" alt="${escapeHtml(result.name)}" class="spotlight-card__image" loading="lazy" onerror="this.style.display='none'">`;
              subtext = `Ticker: ${result.ticker || 'N/A'}`;
              break;
            case 'item':
              image = `<img src="${imageServerUrl}/types/${id}/icon?size=64" alt="${escapeHtml(result.name)}" class="spotlight-card__image spotlight-card__image--item" loading="lazy" onerror="this.style.display='none'">`;
              subtext = result.groupName || 'Item';
              break;
            case 'system':
              image = `<div class="spotlight-card__placeholder-icon">🌟</div>`;
              subtext = result.regionName || 'Unknown Region';
              break;
            case 'constellation':
              image = `<div class="spotlight-card__placeholder-icon">🌌</div>`;
              subtext = result.regionName || 'Unknown Region';
              break;
            case 'region':
              image = `<div class="spotlight-card__placeholder-icon">🗺️</div>`;
              subtext = 'Region';
              break;
            case 'killmail':
              image = `<img src="${imageServerUrl}/types/${result.shipTypeId}/render?size=128" alt="${escapeHtml(result.name)}" class="spotlight-card__image" loading="lazy" onerror="this.style.display='none'">`;
              subtext = `Victim: ${result.victimName || 'N/A'}`;
              valueText = `<div class="spotlight-card__value">${result.value ? `${(result.value / 1e9).toFixed(2)}B ISK` : 'Value N/A'}</div>`;
              break;
          }

          html += `
            <div class="spotlight-result-item spotlight-card" data-index="${resultIndex}" onclick="navigateToResult(currentResults[${resultIndex}])">
              <div class="spotlight-card__image-container">${image}</div>
              <div class="spotlight-card__content">
                <div class="spotlight-card__name">${escapeHtml(result.name)}</div>
                <div class="spotlight-card__subtext">${escapeHtml(subtext)}</div>
                ${valueText}
              </div>
            </div>
          `;
        });
        html += `</div></div>`;
      }
    });

    resultsContainer.innerHTML = html;
  }

  function renderNoResults(query) {
    resultsContainer.innerHTML = `
      <div class="spotlight-no-results">
        <div class="spotlight-no-results-icon">🔍</div>
        <div class="spotlight-no-results-text">No results found for "${escapeHtml(query)}"</div>
      </div>
    `;
  }

  function updateSelection() {
    const items = resultsContainer.querySelectorAll('.spotlight-result-item');
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  function navigateToResult(result) {
    if (window.SearchHistory) {
      window.SearchHistory.add(searchInput.value);
    }
    window.location.href = getResultUrl(result);
  }

  function getResultUrl(result) {
    const routes = {
      character: `/character/${result.id}`,
      corporation: `/corporation/${result.id}`,
      alliance: `/alliance/${result.id}`,
      system: `/system/${result.id}`,
      constellation: `/constellation/${result.id}`,
      region: `/region/${result.id}`,
      item: `/item/${result.id}`,
      killmail: `/kill/${result.id}`
    };
    return routes[result.type] || '#';
  }

  // Global function for recent search selection
  window.spotlightSelectRecent = function(query) {
    searchInput.value = query;
    searchInput.dispatchEvent(new Event('input'));
  };

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
