// Fitting Wheel initialization and interactivity
(function () {
  const fittingWheel = document.getElementById('fittingWheel');
  if (!fittingWheel) return;

  const tooltipOverlay = document.getElementById('tooltipOverlay');
  const tooltipName = document.getElementById('tooltipName');
  const tooltipValue = document.getElementById('tooltipValue');
  const tooltipStatus = document.getElementById('tooltipStatus');
  const shipContainer = fittingWheel.querySelector('.ship-container');

  let tooltipTimer = null;
  let isPinned = false;
  const HIDE_DELAY = 150;

  function formatNumber(num) {
    return Math.floor(num)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function getSlotPosition(slotType, slotIndex) {
    const radius = 42;
    let angle = 0;

    // Calculate angles for different slot types (matching Thessia)
    switch (slotType) {
      case 'high':
        angle = -125 + slotIndex * 10.5;
        break;
      case 'mid':
        angle = 0 - 37 + slotIndex * 10.5;
        break;
      case 'low':
        angle = 90 - 36 + slotIndex * 10.5;
        break;
      case 'rig':
        angle = 218 - 22 + slotIndex * 10.5;
        break;
      case 'subsystem':
        angle = 170 - 30 + slotIndex * 10.5;
        break;
    }

    const rad = angle * (Math.PI / 180);
    const x = 50 + radius * Math.cos(rad);
    const y = 50 + radius * Math.sin(rad);

    // Round to prevent floating-point precision issues
    const roundedX = Math.round(x * 1000) / 1000;
    const roundedY = Math.round(y * 1000) / 1000;

    return {
      left: roundedX + '%',
      top: roundedY + '%',
    };
  }

  function showTooltip(element) {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }

    const name = element.dataset.name;
    const totalValue = parseFloat(element.dataset.price) || 0;
    const status = element.dataset.status || 'destroyed';

    tooltipName.textContent = name;
    tooltipValue.textContent = formatNumber(totalValue) + ' ISK';
    
    // Format status text
    const statusCapitalized = status.charAt(0).toUpperCase() + status.slice(1);
    tooltipStatus.innerHTML = `<span class="status-${status}">${statusCapitalized}</span>`;

    shipContainer.classList.add('darkened');
    tooltipOverlay.classList.remove('hidden');
  }

  function hideTooltip() {
    if (isPinned) return;

    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
    }

    tooltipTimer = setTimeout(() => {
      if (!isPinned) {
        tooltipOverlay.classList.add('hidden');
        shipContainer.classList.remove('darkened');
      }
    }, HIDE_DELAY);
  }

  function togglePinned() {
    isPinned = !isPinned;
    if (!isPinned) {
      hideTooltip();
    }
  }

  // Position slot indicators
  function getIndicatorPosition(position) {
    const radius = 42;
    let angle = 0;

    switch (position) {
      case 'top':
        angle = -125 - 9;
        break;
      case 'right':
        angle = -35 - 10;
        break;
      case 'bottom':
        angle = 90 - 35 - 10;
        break;
    }

    const rad = angle * (Math.PI / 180);
    const x = 50 + radius * Math.cos(rad);
    const y = 50 + radius * Math.sin(rad);

    const roundedX = Math.round(x * 1000) / 1000;
    const roundedY = Math.round(y * 1000) / 1000;

    return {
      left: roundedX + '%',
      top: roundedY + '%',
    };
  }

  // Position indicators
  const highIndicator = fittingWheel.querySelector('.high-indicator');
  const midIndicator = fittingWheel.querySelector('.mid-indicator');
  const lowIndicator = fittingWheel.querySelector('.low-indicator');

  if (highIndicator) {
    const pos = getIndicatorPosition('top');
    highIndicator.style.left = pos.left;
    highIndicator.style.top = pos.top;
    highIndicator.style.transform = 'translate(-50%, -50%)';
  }

  if (midIndicator) {
    const pos = getIndicatorPosition('right');
    midIndicator.style.left = pos.left;
    midIndicator.style.top = pos.top;
    midIndicator.style.transform = 'translate(-50%, -50%)';
  }

  if (lowIndicator) {
    const pos = getIndicatorPosition('bottom');
    lowIndicator.style.left = pos.left;
    lowIndicator.style.top = pos.top;
    lowIndicator.style.transform = 'translate(-50%, -50%)';
  }

  // Position all slots
  const slots = fittingWheel.querySelectorAll('.slot');
  slots.forEach((slot) => {
    const slotType = slot.dataset.slotType;
    const slotIndex = parseInt(slot.dataset.slotIndex);
    const position = getSlotPosition(slotType, slotIndex);

    slot.style.left = position.left;
    slot.style.top = position.top;
    slot.style.transform = 'translate(-50%, -50%)';

    // Add positioned class to make slot visible
    slot.classList.add('positioned');

    // Tooltip events for module
    const moduleContainer = slot.querySelector('.module-container');
    if (moduleContainer) {
      moduleContainer.addEventListener('mouseenter', () => showTooltip(slot));
      moduleContainer.addEventListener('mouseleave', hideTooltip);
      moduleContainer.addEventListener('click', togglePinned);
    }

    // Tooltip events for ammo overlay
    const ammoOverlay = slot.querySelector('.ammo-overlay');
    if (ammoOverlay) {
      ammoOverlay.addEventListener('mouseenter', () => showTooltip(ammoOverlay));
      ammoOverlay.addEventListener('mouseleave', hideTooltip);
      ammoOverlay.addEventListener('click', togglePinned);
    }
  });

  // Tooltip overlay hover handling
  tooltipOverlay.addEventListener('mouseenter', () => {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
  });

  tooltipOverlay.addEventListener('mouseleave', hideTooltip);

  // Click outside to unpin
  document.addEventListener('click', (e) => {
    const isOutsideWheel = !e.target.closest('.fitting-wheel');
    if (isOutsideWheel && isPinned) {
      isPinned = false;
      hideTooltip();
    }
  });
})();
