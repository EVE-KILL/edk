/**
 * Site Real-Time Updates Handler
 *
 * Connects to the WebSocket /updates endpoint and handles real-time updates:
 * - killlist: New killmails appearing in the killlist
 * - entity-update: Entity names (characters, corporations, alliances) updating across the site
 * - value-update: Killmail ISK value updates
 *
 * Uses data-<entity-type>-id attributes to identify and update elements dynamically.
 */

class SiteUpdatesManager {
  constructor() {
    this.socket = null;
    this.maxKillmails = 20; // Default - will be detected from current list
    this.killlistContainer = null;
    this.killmailRows = null;
    this.connected = false;
    this.updateQueue = [];
    this.isProcessingUpdate = false;

    // Entity update cache - stores entity updates that arrive before the row is added to DOM
    this.entityUpdateCache = {}; // Map of "type:id" -> { type, id, name }

    // Filter configuration
    this.filterConfig = {
      type: 'all', // 'all', 'kills', 'losses', or specific kill type
      systemId: null,
      regionId: null,
      regionIdMin: null,
      regionIdMax: null,
      characterIds: [],
      corporationIds: [],
      allianceIds: [],
      shipGroupIds: [],
      isSolo: false,
      isNpc: false,
      minValue: null,
      minSecurityStatus: null,
      maxSecurityStatus: null,
    };

    this.init();
  }

  /**
   * Initialize the WebSocket connection and DOM references
   */
  init() {
    // Find the killlist container (optional - only needed for killlist updates)
    this.killlistContainer = document.querySelector('.kb-kl-list');

    if (this.killlistContainer) {
      // Load filter configuration from data attributes
      this.loadFilterConfig();

      // Check if websocket updates are disabled for this killlist
      if (this.filterConfig.disableWebsocket) {
        console.log('[Site Updates] WebSocket updates disabled for this killlist');
        return;
      }

      // Get the current number of killmails displayed
      this.updateKillmailRowCount();
    }

    // Connect to WebSocket (always connect for entity/value updates)
    this.connect();
  }

  /**
   * Load filter configuration from data attributes on the killlist container
   */
  loadFilterConfig() {
    const config = this.killlistContainer.dataset.filterConfig;
    if (config) {
      try {
        const parsed = JSON.parse(config);
        this.filterConfig = { ...this.filterConfig, ...parsed };
      } catch (error) {
        console.warn('[Site Updates] Failed to parse filter config:', error);
      }
    }
  }

  /**
   * Build effective filters by interpreting the kill type
   * Replicates server-side buildFiltersForType() logic from /kills/[type].ts
   */
  buildEffectiveFilters() {
    // Start with filters from config (these may be explicitly set)
    const filters = { ...this.filterConfig };

    const filterType = this.filterConfig.type || 'all';

    // Ship group IDs based on server-side SHIP_GROUPS mapping
    const SHIP_GROUPS = {
      big: [547, 485, 513, 902, 941, 30, 659],
      citadels: [1657, 1406, 1404, 1408, 2017, 2016],
      t1: [419, 27, 29, 547, 26, 420, 25, 28, 941, 463, 237, 31],
      t2: [324, 898, 906, 540, 830, 893, 543, 541, 833, 358, 894, 831, 902, 832, 900, 834, 380],
      t3: [963, 1305],
      frigates: [324, 893, 25, 831, 237],
      destroyers: [420, 541],
      cruisers: [906, 26, 833, 358, 894, 832, 963],
      battlecruisers: [419, 540],
      battleships: [27, 898, 900],
      capitals: [547, 485],
      freighters: [513, 902],
      supercarriers: [659],
      titans: [30],
    };

    // Apply kill-type-specific filters
    // Only apply if filters weren't explicitly set (from server-side config)
    switch (filterType) {
      case 'latest':
      case 'all':
        // No filters - show everything (same as frontpage)
        return {};
        break;

      case 'big':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.big;
        break;

      case 'solo':
        if (filters.isSolo === undefined) filters.isSolo = true;
        break;

      case 'npc':
        if (filters.isNpc === undefined) filters.isNpc = true;
        break;

      case 'highsec':
        if (filters.minSecurityStatus === null) filters.minSecurityStatus = 0.45;
        break;

      case 'lowsec':
        if (filters.minSecurityStatus === null) filters.minSecurityStatus = 0.0;
        if (filters.maxSecurityStatus === null) filters.maxSecurityStatus = 0.45;
        break;

      case 'nullsec':
        if (filters.maxSecurityStatus === null) filters.maxSecurityStatus = 0.0;
        break;

      case 'w-space':
        if (filters.regionIdMin === null) filters.regionIdMin = 11000001;
        if (filters.regionIdMax === null) filters.regionIdMax = 11000033;
        break;

      case 'abyssal':
        if (filters.regionIdMin === null) filters.regionIdMin = 12000000;
        if (filters.regionIdMax === null) filters.regionIdMax = 13000000;
        break;

      case 'pochven':
        if (filters.regionId === null) filters.regionId = 10000070;
        break;

      case '5b':
        if (filters.minValue === null) filters.minValue = 5000000000;
        break;

      case '10b':
        if (filters.minValue === null) filters.minValue = 10000000000;
        break;

      case 'frigates':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.frigates;
        break;

      case 'destroyers':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.destroyers;
        break;

      case 'cruisers':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.cruisers;
        break;

      case 'battlecruisers':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.battlecruisers;
        break;

      case 'battleships':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.battleships;
        break;

      case 'capitals':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.capitals;
        break;

      case 'supercarriers':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.supercarriers;
        break;

      case 'titans':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.titans;
        break;

      case 'freighters':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.freighters;
        break;

      case 'citadels':
      case 'structures':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.citadels;
        break;

      case 't1':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.t1;
        break;

      case 't2':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.t2;
        break;

      case 't3':
        if (!filters.shipGroupIds) filters.shipGroupIds = SHIP_GROUPS.t3;
        break;
    }

    return filters;
  }

  /**
   * Check if a killmail matches the current filters
   */
  matchesFilters(killmail) {
    // Build effective filters based on the type
    // This replicates the server-side buildFiltersForType() logic
    const effectiveFilters = this.buildEffectiveFilters();

    // If systemId is set, only show kills from that system
    if (effectiveFilters.systemId) {
      if (killmail.solar_system.id !== effectiveFilters.systemId) {
        return false;
      }
    }

    // If regionId is set, only show kills from that region
    if (effectiveFilters.regionId) {
      if (killmail.solar_system.region_id !== effectiveFilters.regionId) {
        return false;
      }
    }

    // If region range is set (for abyssal/wspace), check if region is in range
    if (effectiveFilters.regionIdMin !== null && effectiveFilters.regionIdMax !== null) {
      const regionId = killmail.solar_system.region_id;
      if (regionId < effectiveFilters.regionIdMin || regionId > effectiveFilters.regionIdMax) {
        return false;
      }
    }

    // Security status filters
    if (effectiveFilters.minSecurityStatus !== null) {
      if (killmail.solar_system.security_status < effectiveFilters.minSecurityStatus) {
        return false;
      }
    }
    if (effectiveFilters.maxSecurityStatus !== null) {
      if (killmail.solar_system.security_status > effectiveFilters.maxSecurityStatus) {
        return false;
      }
    }

    // Ship group filter (victim ship)
    if (effectiveFilters.shipGroupIds && effectiveFilters.shipGroupIds.length > 0) {
      // Check if victim ship's group ID is in the filter list
      if (!killmail.victim.ship.group_id ||
          !effectiveFilters.shipGroupIds.includes(killmail.victim.ship.group_id)) {
        return false;
      }
    }

    // Solo filter
    if (effectiveFilters.isSolo) {
      // Check if attacker count is 1
      if (!killmail.attacker_count || killmail.attacker_count !== 1) {
        return false;
      }
    }

    // NPC filter
    if (effectiveFilters.isNpc) {
      // Check if victim has no character ID (NPC kill)
      if (killmail.victim.character.id !== null) {
        return false;
      }
    }

    // Minimum value filter
    if (effectiveFilters.minValue !== null) {
      if (killmail.ship_value < effectiveFilters.minValue) {
        return false;
      }
    }

    // Entity-based filtering (only applies when filtering by character/corp/alliance)
    // The 'type' field can be:
    // - 'kills' or 'losses' (for entity pages filtering by involvement)
    // - 'all' (for entity pages showing both kills and losses)
    // - A kill type like 'latest', 'big', 'solo', etc. (for kills pages - ignore entity filtering)
    const filterType = effectiveFilters.type || 'all';

    // Known kill types that should NOT apply entity-based filtering
    const killTypes = [
      'latest', 'big', 'solo', 'npc', 'highsec', 'lowsec', 'nullsec',
      'w-space', 'abyssal', 'pochven', '5b', '10b',
      'frigates', 'destroyers', 'cruisers', 'battlecruisers', 'battleships',
      'capitals', 'supercarriers', 'titans', 'freighters', 'citadels', 'structures',
      't1', 't2', 't3'
    ];

    // Only apply entity filtering if type is 'all', 'kills', or 'losses'
    const isEntityFilterType = ['all', 'kills', 'losses'].includes(filterType);

    // Skip entity filtering if this is a kill type filter
    const isKillTypeFilter = killTypes.includes(filterType);

    // Only apply entity-based kill/loss filtering if we have an entity filter type
    // AND we're not using a kill type filter
    if (isEntityFilterType && !isKillTypeFilter) {
      // If characterIds is set, check if character is involved based on filter type
      if (effectiveFilters.characterIds && effectiveFilters.characterIds.length > 0) {
        const characterInAttackers = killmail.attackers.some(a =>
          effectiveFilters.characterIds.includes(a.character.id)
        );
        const characterIsVictim = effectiveFilters.characterIds.includes(killmail.victim.character.id);

        if (filterType === 'kills' && !characterInAttackers) {
          return false;
        }
        if (filterType === 'losses' && !characterIsVictim) {
          return false;
        }
        if (filterType === 'all' && !characterInAttackers && !characterIsVictim) {
          return false;
        }
      }

      // If corporationIds is set, check if corporation is involved based on filter type
      if (effectiveFilters.corporationIds && effectiveFilters.corporationIds.length > 0) {
        const corporationInAttackers = killmail.attackers.some(a =>
          effectiveFilters.corporationIds.includes(a.corporation.id)
        );
        const corporationIsVictim = effectiveFilters.corporationIds.includes(killmail.victim.corporation.id);

        if (filterType === 'kills' && !corporationInAttackers) {
          return false;
        }
        if (filterType === 'losses' && !corporationIsVictim) {
          return false;
        }
        if (filterType === 'all' && !corporationInAttackers && !corporationIsVictim) {
          return false;
        }
      }

      // If allianceIds is set, check if alliance is involved based on filter type
      if (effectiveFilters.allianceIds && effectiveFilters.allianceIds.length > 0) {
        const allianceInAttackers = killmail.attackers.some(a =>
          a.alliance && effectiveFilters.allianceIds.includes(a.alliance.id)
        );
        const allianceIsVictim = killmail.victim.alliance &&
          effectiveFilters.allianceIds.includes(killmail.victim.alliance.id);

        if (filterType === 'kills' && !allianceInAttackers) {
          return false;
        }
        if (filterType === 'losses' && !allianceIsVictim) {
          return false;
        }
        if (filterType === 'all' && !allianceInAttackers && !allianceIsVictim) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Update the count of currently displayed killmail rows
   */
  updateKillmailRowCount() {
    // Count all row divs, excluding the header
    const rows = this.killlistContainer.querySelectorAll('.kb-kl-row:not(.kb-kl-row--header):not(.kb-kl-row--empty)');
    this.maxKillmails = rows.length || 20;

    // Store killmail IDs on existing rows for chronological ordering
    rows.forEach((row) => {
      // Try to get killmail ID from data attribute (will be set for newly added rows)
      if (!row.hasAttribute('data-killmail-id')) {
        // For existing rows from initial page load, extract from onclick attribute
        // onclick="window.location.href='/killmail/130733134';"
        const onclick = row.getAttribute('onclick');
        if (onclick) {
          const match = onclick.match(/\/killmail\/(\d+)/);
          if (match) {
            row.setAttribute('data-killmail-id', match[1]);
          } else {
            row.setAttribute('data-killmail-id', '0');
          }
        } else {
          row.setAttribute('data-killmail-id', '0');
        }
      }
    });
  }

  /**
   * Connect to the WebSocket endpoint
   */
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/updates`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.addEventListener('open', () => this.onOpen());
      this.socket.addEventListener('message', (event) => this.onMessage(event));
      this.socket.addEventListener('close', () => this.onClose());
      this.socket.addEventListener('error', (event) => this.onError(event));
    } catch (error) {
      console.error('[Site Updates] Failed to create WebSocket:', error);
    }
  }

  /**
   * WebSocket opened
   */
  onOpen() {
    this.connected = true;
  }

  /**
   * WebSocket message received
   */
  onMessage(event) {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'killlist') {
        // Queue the update to process sequentially (only if we have a killlist container)
        if (this.killlistContainer) {
          this.updateQueue.push(message.data.killmail);
          this.processNextUpdate();
        }
      } else if (message.type === 'entity-update') {
        // Handle entity data updates (characters, corporations, alliances)
        this.handleEntityUpdate(message.data);
      } else if (message.type === 'value-update') {
        // Handle killmail value updates
        this.handleValueUpdate(message.data);
      } else {
        console.log('[Site Updates] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[Site Updates] Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle entity data updates (characters, corporations, alliances only)
   */
  handleEntityUpdate(entityData) {
    const { entityType, id, name } = entityData;

    // Only handle character, corporation, and alliance updates
    if (!entityType || !id || !name) {
      return;
    }

    if (!['character', 'corporation', 'alliance'].includes(entityType)) {
      console.log(`[Site Updates] Unsupported entityType: ${entityType} - skipping`);
      return; // Skip other entity types
    }

    const cacheKey = `${entityType}:${id}`;

    // Store in cache for future rows
    this.entityUpdateCache[cacheKey] = { entityType, id, name };

    // Update all existing elements with this entity
    const selector = `[data-${entityType}-id="${id}"]`;
    const elements = document.querySelectorAll(selector);

    if (elements.length > 0) {
      console.log(`[Site Updates] Entity update: ${entityType} ${id} = ${name} (${elements.length} elements found)`);
      elements.forEach(el => {
        this.applyEntityUpdate(el, entityType, id, name);
      });
    }
  }

  /**
   * Apply entity update to an element
   */
  applyEntityUpdate(el, entityType, id, name) {
    // Check if this element contains a link
    const link = el.querySelector('a');

    if (link) {
      // Update the link text and href
      const currentText = link.textContent.trim();

      // Always update if it says "Unknown"
      if (currentText.includes('Unknown')) {
        link.textContent = name;
        link.title = `${name} (ID: ${id})`;
        link.classList.add('entity-updated');

        console.log(`[Site Updates] ✓ Updated ${entityType} link: ${name}`);

        // Fade in effect
        el.style.opacity = '0.5';
        setTimeout(() => {
          el.style.transition = 'opacity 0.3s ease-in';
          el.style.opacity = '1';
        }, 10);
      }
    } else {
      // No link, just update the text content directly
      if (el.textContent.includes('Unknown')) {
        el.textContent = name;
        el.title = `${name} (ID: ${id})`;
        el.classList.add('entity-updated');

        console.log(`[Site Updates] ✓ Updated ${entityType} text: ${name}`);

        // Fade in effect
        el.style.opacity = '0.5';
        setTimeout(() => {
          el.style.transition = 'opacity 0.3s ease-in';
          el.style.opacity = '1';
        }, 10);
      }
    }
  }

  /**
   * Handle killmail value updates
   */
  handleValueUpdate(valueData) {
    const { killmailId, totalValue } = valueData;

    if (!killmailId || totalValue === undefined) {
      console.log('[Site Updates] Missing killmailId or totalValue - skipping');
      return;
    }

    // Find all elements with data-killmail-id attribute
    const selector = `[data-killmail-id="${killmailId}"]`;
    const elements = document.querySelectorAll(selector);

    if (elements.length > 0) {
      console.log(`[Site Updates] Value update: Killmail ${killmailId} = ${this.formatISK(totalValue)} (${elements.length} elements found)`);
      elements.forEach(el => {
        this.applyValueUpdate(el, totalValue);
      });
    }
  }

  /**
   * Apply value update to a killmail element
   */
  applyValueUpdate(el, totalValue) {
    // Find the value display element within this killmail
    // Check for both the normal value element and the "unknown" placeholder
    let valueElement = el.querySelector('.kb-kl-value, .isk-value, .kb-kl-value--unknown');

    if (valueElement) {
      const formattedValue = this.formatISK(totalValue);
      const currentText = valueElement.textContent.trim();

      // Only update if it's currently showing N/A or is different
      if (currentText.includes('N/A') || currentText === '' || currentText !== formattedValue) {
        valueElement.textContent = formattedValue;
        valueElement.classList.remove('kb-kl-value--unknown');
        valueElement.classList.add('kb-kl-value', 'value-updated');

        console.log(`[Site Updates] ✓ Updated value: ${formattedValue}`);

        // Fade in effect
        valueElement.style.opacity = '0.5';
        setTimeout(() => {
          valueElement.style.transition = 'opacity 0.3s ease-in';
          valueElement.style.opacity = '1';
        }, 10);
      }
    } else {
      console.log('[Site Updates] No value element found in killmail');
    }
  }

  /**
   * Apply cached entity updates to a newly added row
   */
  applyCachedUpdates(row) {
    // Find all elements with data-*-id attributes (only character, corporation, alliance)
    const elements = row.querySelectorAll('[data-character-id], [data-corporation-id], [data-alliance-id]');

    elements.forEach(el => {
      // Check which type of entity this is
      if (el.hasAttribute('data-character-id')) {
        const id = el.getAttribute('data-character-id');
        const cacheKey = `character:${id}`;
        if (this.entityUpdateCache[cacheKey]) {
          const { entityType, name } = this.entityUpdateCache[cacheKey];
          this.applyEntityUpdate(el, entityType, id, name);
        }
      } else if (el.hasAttribute('data-corporation-id')) {
        const id = el.getAttribute('data-corporation-id');
        const cacheKey = `corporation:${id}`;
        if (this.entityUpdateCache[cacheKey]) {
          const { entityType, name } = this.entityUpdateCache[cacheKey];
          this.applyEntityUpdate(el, entityType, id, name);
        }
      } else if (el.hasAttribute('data-alliance-id')) {
        const id = el.getAttribute('data-alliance-id');
        const cacheKey = `alliance:${id}`;
        if (this.entityUpdateCache[cacheKey]) {
          const { entityType, name } = this.entityUpdateCache[cacheKey];
          this.applyEntityUpdate(el, entityType, id, name);
        }
      }
    });
  }

  /**
   * Process the next update in the queue
   */
  async processNextUpdate() {
    if (this.isProcessingUpdate || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessingUpdate = true;
    const killmail = this.updateQueue.shift();

    try {
      await this.addKillmailRow(killmail);
    } catch (error) {
      console.error('[Site Updates] Failed to add killmail row:', error);
    }

    this.isProcessingUpdate = false;

    // Process next in queue if available
    if (this.updateQueue.length > 0) {
      // Small delay to avoid overwhelming the UI
      setTimeout(() => this.processNextUpdate(), 100);
    }
  }

  /**
   * Add a new killmail row to the top of the list
   * Only adds if the killmail ID is higher than the first row (newer kill)
   * and if it matches the configured filters
   */
  async addKillmailRow(killmail) {
    // First, check if the killmail matches configured filters
    if (!this.matchesFilters(killmail)) {
      console.log('[Site Updates] Killmail does not match filters - skipping');
      return;
    }

    // Get the first non-header row to check its killmail ID
    const allRows = this.killlistContainer.querySelectorAll('.kb-kl-row:not(.kb-kl-row--header):not(.kb-kl-row--empty)');

    let firstRowId = 0;
    const newKillmailId = killmail.killmail_id;

    if (allRows.length > 0) {
      const firstRow = allRows[0];
      firstRowId = parseInt(firstRow.getAttribute('data-killmail-id') || '0', 10);

      // Don't add if the new killmail ID is lower (older kill)
      if (newKillmailId <= firstRowId) {
        return;
      }
    }
    console.log(`[Site Updates] Adding killmail ${newKillmailId} (first row ID: ${firstRowId})`);

    // Remove empty state if it exists
    const emptyState = this.killlistContainer.querySelector('.kb-kl-row--empty');
    if (emptyState) {
      emptyState.remove();
    }

    // Create new row HTML
    const rowHtml = this.createKillmailRowHtml(killmail);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rowHtml;
    const newRow = tempDiv.firstElementChild;

    // Store killmail ID for comparison
    newRow.setAttribute('data-killmail-id', killmail.killmail_id.toString());

    // Add click handler
    newRow.addEventListener('click', () => {
      window.location.href = `/killmail/${killmail.killmail_id}`;
    });

    // Find the header row and insert after it
    const headerRow = this.killlistContainer.querySelector('.kb-kl-row--header');
    if (headerRow) {
      headerRow.insertAdjacentElement('afterend', newRow);
    } else {
      // No header, just prepend
      this.killlistContainer.insertBefore(newRow, this.killlistContainer.firstChild);
    }

    console.log('[Site Updates] ✅ Killmail row added to DOM');

    // Apply any cached entity updates to this new row
    this.applyCachedUpdates(newRow);

    // Animate the new row
    this.animateNewRow(newRow);

    // Check if we need to remove the oldest row to maintain max count
    const updatedRows = this.killlistContainer.querySelectorAll('.kb-kl-row:not(.kb-kl-row--header):not(.kb-kl-row--empty)');
    if (updatedRows.length > this.maxKillmails) {
      const oldestRow = updatedRows[updatedRows.length - 1];
      await this.removeRow(oldestRow);
    }
  }

  /**
   * Create HTML for a killmail row
   */
  createKillmailRowHtml(killmail) {
    const {
      killmail_id,
      killmail_time,
      ship_value,
      attacker_count,
      victim,
      attackers,
      solar_system,
    } = killmail;

    const finalBlow = attackers.find((a) => a.final_blow) || attackers[0];
    const shipName = victim.ship.name || 'Unknown';
    const shipGroup = victim.ship.group || '';

    // Format ISK value
    const iskValue = this.formatISK(ship_value);

    // Format time
    const timeStr = this.formatTime(new Date(killmail_time));

    // Build HTML
    return `
      <div class="kb-kl-row" data-killmail-id="${killmail_id}" style="cursor: pointer;">
        <!-- Ship -->
        <div class="kb-kl-col kb-kl-col--ship">
          <div class="kb-kl-ship">
            <img src="https://images.eve-kill.com/types/${victim.ship.type_id}/icon?size=64"
                 alt="${shipName}"
                 class="kb-kl-ship-icon"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect fill=%22%23666%22 width=%2248%22 height=%2248%22/%3E%3C/svg%3E'">
            <div class="kb-kl-info kb-kl-info--ship">
              <div class="kb-kl-info__primary" ${victim.ship.type_id ? `data-type-id="${victim.ship.type_id}"` : ''}>${shipName}</div>
              <div class="kb-kl-info__secondary">${shipGroup}</div>
            </div>
          </div>
        </div>

        <!-- Victim -->
        <div class="kb-kl-col kb-kl-col--victim">
          <div class="kb-kl-info kb-kl-info--victim">
            <div class="kb-kl-info__primary" data-character-id="${victim.character.id}">
              ${victim.character.id
                ? `<a href="/character/${victim.character.id}" class="kb-kl-info__link" onclick="event.stopPropagation();">${victim.character.name}</a>`
                : victim.character.name}
            </div>
            <div class="kb-kl-info__secondary" data-corporation-id="${victim.corporation.id}">
              ${victim.corporation.id
                ? `<a href="/corporation/${victim.corporation.id}" class="kb-kl-info__link--secondary" onclick="event.stopPropagation();">${victim.corporation.name}</a>`
                : victim.corporation.name}
            </div>
            ${victim.alliance.name
              ? `<div class="kb-kl-info__secondary" data-alliance-id="${victim.alliance.id}">
                  ${victim.alliance.id
                    ? `<a href="/alliance/${victim.alliance.id}" class="kb-kl-info__link--secondary" onclick="event.stopPropagation();">${victim.alliance.name}</a>`
                    : victim.alliance.name}
                </div>`
              : ''}
          </div>
        </div>

        <!-- Final Blow -->
        <div class="kb-kl-col kb-kl-col--finalblow">
          <div class="kb-kl-info kb-kl-info--finalblow">
            ${finalBlow
              ? `<div class="kb-kl-info__primary" data-character-id="${finalBlow.character.id}">
                  ${finalBlow.character.id
                    ? `<a href="/character/${finalBlow.character.id}" class="kb-kl-info__link" onclick="event.stopPropagation();">${finalBlow.character.name}</a>`
                    : finalBlow.character.name}
                </div>
                <div class="kb-kl-info__secondary" data-corporation-id="${finalBlow.corporation.id}">
                  ${finalBlow.corporation.id
                    ? `<a href="/corporation/${finalBlow.corporation.id}" class="kb-kl-info__link--secondary" onclick="event.stopPropagation();">${finalBlow.corporation.name}</a>`
                    : finalBlow.corporation.name}
                </div>
                ${finalBlow.alliance && finalBlow.alliance.name
                  ? `<div class="kb-kl-info__secondary" data-alliance-id="${finalBlow.alliance.id}">
                      ${finalBlow.alliance.id
                        ? `<a href="/alliance/${finalBlow.alliance.id}" class="kb-kl-info__link--secondary" onclick="event.stopPropagation();">${finalBlow.alliance.name}</a>`
                        : finalBlow.alliance.name}
                    </div>`
                  : ''}`
              : '<div class="kb-kl-value--unknown">Unknown</div>'}
          </div>
        </div>

        <!-- Location -->
        <div class="kb-kl-col kb-kl-col--location">
          <div class="kb-kl-info">
            <div class="kb-kl-info__primary">${solar_system.name}</div>
            <div class="kb-kl-info__secondary">${solar_system.region}</div>
          </div>
        </div>

        <!-- Value -->
        <div class="kb-kl-col kb-kl-col--value">
          <div class="kb-kl-info kb-kl-info--value">
            ${ship_value
              ? `<div class="kb-kl-value">${iskValue}</div>`
              : '<div class="kb-kl-value--unknown">N/A</div>'}
            ${attacker_count
              ? `<div class="kb-kl-info__secondary kb-kl-attackers-count">(${attacker_count})</div>`
              : ''}
          </div>
        </div>

        <!-- Time -->
        <div class="kb-kl-col kb-kl-col--time">
          <span class="kb-kl-time">${timeStr}</span>
        </div>
      </div>
    `;
  }

  /**
   * Format ISK value (abbreviated)
   */
  formatISK(value) {
    if (value >= 1_000_000_000) {
      return (value / 1_000_000_000).toFixed(2) + 'B';
    }
    if (value >= 1_000_000) {
      return (value / 1_000_000).toFixed(2) + 'M';
    }
    if (value >= 1_000) {
      return (value / 1_000).toFixed(2) + 'K';
    }
    return value.toFixed(0);
  }

  /**
   * Format time - matches the Handlebars formatDate helper
   * Uses 24-hour format: "October 22, 2025 at 17:35"
   */
  formatTime(date) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false, // Use 24-hour format
    });
  }

  /**
   * Animate the new row (fade in)
   */
  animateNewRow(row) {
    row.style.opacity = '0';
    row.style.transition = 'opacity 0.3s ease-in';
    row.style.transform = 'translateY(-10px)';
    row.style.transform = 'translateY(-10px)';

    // Trigger reflow to start animation
    void row.offsetWidth;

    row.style.opacity = '1';
    row.style.transform = 'translateY(0)';
  }

  /**
   * Remove a row with animation
   */
  async removeRow(row) {
    return new Promise((resolve) => {
      row.style.transition = 'opacity 0.3s ease-out';
      row.style.opacity = '0';

      setTimeout(() => {
        row.remove();
        resolve();
      }, 300);
    });
  }

  /**
   * WebSocket closed
   */
  onClose() {
    this.connected = false;
    console.log('[Site Updates] ⚠️  WebSocket closed - reconnecting in 5 seconds...');

    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      this.connect();
    }, 5000);
  }

  /**
   * WebSocket error
   */
  onError(event) {
    console.error('❌ [Site Updates] WebSocket error:', event);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.siteUpdates = new SiteUpdatesManager();
  });
} else {
  window.siteUpdates = new SiteUpdatesManager();
}
