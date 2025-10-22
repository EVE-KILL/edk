/**
 * Killlist Real-Time Updates Handler
 *
 * Connects to the WebSocket /updates endpoint and updates the killlist
 * in real-time as new kills are reported. Maintains a consistent number
 * of killmails displayed by removing the oldest when a new one is added.
 */

class KilllistUpdatesManager {
  constructor() {
    this.socket = null;
    this.maxKillmails = 20; // Default - will be detected from current list
    this.killlistContainer = null;
    this.killmailRows = null;
    this.connected = false;
    this.updateQueue = [];
    this.isProcessingUpdate = false;

    this.init();
  }

  /**
   * Initialize the WebSocket connection and DOM references
   */
  init() {
    // Find the killlist container
    this.killlistContainer = document.querySelector('.kb-kl-list');
    if (!this.killlistContainer) {
      console.warn('[Killlist] No killlist container found on this page');
      return;
    }

    // Get the current number of killmails displayed
    this.updateKillmailRowCount();

    // Connect to WebSocket
    this.connect();
  }

  /**
   * Update the count of currently displayed killmail rows
   */
  updateKillmailRowCount() {
    // Count all row divs, excluding the header
    const rows = this.killlistContainer.querySelectorAll('.kb-kl-row:not(.kb-kl-row--header):not(.kb-kl-row--empty)');
    this.maxKillmails = rows.length || 20;
    console.log(`[Killlist] Detected ${this.maxKillmails} killmails on page`);

    // Store killmail IDs on existing rows for chronological ordering
    rows.forEach((row) => {
      // Try to get killmail ID from data attribute (will be set for newly added rows)
      if (!row.hasAttribute('data-killmail-id')) {
        // For existing rows from initial page load, extract from first column or use placeholder
        // We'll rely on the WebSocket comparison to handle ordering
        row.setAttribute('data-killmail-id', '0');
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
      console.error('[Killlist] Failed to create WebSocket:', error);
    }
  }

  /**
   * WebSocket opened
   */
  onOpen() {
    this.connected = true;
    console.log('✅ [Killlist] Connected to real-time updates');
  }

  /**
   * WebSocket message received
   */
  onMessage(event) {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'killlist') {
        // Queue the update to process sequentially
        this.updateQueue.push(message.data.killmail);
        this.processNextUpdate();
      }
    } catch (error) {
      console.error('[Killlist] Failed to parse WebSocket message:', error);
    }
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
      console.error('[Killlist] Failed to add killmail row:', error);
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
   */
  async addKillmailRow(killmail) {
    // Get the first non-header row to check its killmail ID
    const allRows = this.killlistContainer.querySelectorAll('.kb-kl-row:not(.kb-kl-row--header):not(.kb-kl-row--empty)');
    
    if (allRows.length > 0) {
      const firstRow = allRows[0];
      const firstRowId = parseInt(firstRow.getAttribute('data-killmail-id') || '0', 10);
      const newKillmailId = killmail.killmail_id;
      
      // Don't add if the new killmail ID is lower (older kill)
      if (newKillmailId < firstRowId) {
        console.log(`[Killlist] Skipping older killmail ${newKillmailId} (newer one already at top)`);
        return;
      }
    }

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

    // Animate the new row
    this.animateNewRow(newRow);

    // Check if we need to remove the oldest row to maintain max count
    const updatedRows = this.killlistContainer.querySelectorAll('.kb-kl-row:not(.kb-kl-row--header):not(.kb-kl-row--empty)');
    if (updatedRows.length > this.maxKillmails) {
      const oldestRow = updatedRows[updatedRows.length - 1];
      await this.removeRow(oldestRow);
    }

    console.log(`[Killlist] Added new killmail: ${killmail.killmail_id}`);
  }

  /**
   * Create HTML for a killmail row
   */
  createKillmailRowHtml(killmail) {
    const {
      killmail_id,
      killmail_time,
      ship_value,
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
      <div class="kb-kl-row" style="cursor: pointer;">
        <!-- Ship -->
        <div class="kb-kl-col kb-kl-col--ship">
          <div class="kb-kl-ship">
            <img src="https://images.eve-kill.com/types/${victim.ship.type_id}/icon?size=64"
                 alt="${shipName}"
                 class="kb-kl-ship-icon"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect fill=%22%23666%22 width=%2248%22 height=%2248%22/%3E%3C/svg%3E'">
            <div class="kb-kl-info kb-kl-info--ship">
              <div class="kb-kl-info__primary">${shipName}</div>
              <div class="kb-kl-info__secondary">${shipGroup}</div>
            </div>
          </div>
        </div>

        <!-- Victim -->
        <div class="kb-kl-col kb-kl-col--victim">
          <div class="kb-kl-info kb-kl-info--victim">
            <div class="kb-kl-info__primary">
              ${victim.character.id
                ? `<a href="/character/${victim.character.id}" class="kb-kl-info__link" onclick="event.stopPropagation();">${victim.character.name}</a>`
                : victim.character.name}
            </div>
            <div class="kb-kl-info__secondary">
              ${victim.corporation.id
                ? `<a href="/corporation/${victim.corporation.id}" class="kb-kl-info__link--secondary" onclick="event.stopPropagation();">${victim.corporation.name}</a>`
                : victim.corporation.name}
            </div>
            ${victim.alliance.name
              ? `<div class="kb-kl-info__secondary">
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
              ? `<div class="kb-kl-info__primary">
                  ${finalBlow.character.id
                    ? `<a href="/character/${finalBlow.character.id}" class="kb-kl-info__link" onclick="event.stopPropagation();">${finalBlow.character.name}</a>`
                    : finalBlow.character.name}
                </div>
                <div class="kb-kl-info__secondary">
                  ${finalBlow.corporation.id
                    ? `<a href="/corporation/${finalBlow.corporation.id}" class="kb-kl-info__link--secondary" onclick="event.stopPropagation();">${finalBlow.corporation.name}</a>`
                    : finalBlow.corporation.name}
                </div>
                ${finalBlow.alliance && finalBlow.alliance.name
                  ? `<div class="kb-kl-info__secondary">
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
          ${ship_value
            ? `<span class="kb-kl-value">${iskValue}</span>`
            : '<span class="kb-kl-value--unknown">N/A</span>'}
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
    console.log('❌ [Killlist] Disconnected from real-time updates');

    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      console.log('[Killlist] Attempting to reconnect...');
      this.connect();
    }, 5000);
  }

  /**
   * WebSocket error
   */
  onError(event) {
    console.error('❌ [Killlist] WebSocket error:', event);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.killlistUpdates = new KilllistUpdatesManager();
  });
} else {
  window.killlistUpdates = new KilllistUpdatesManager();
}
