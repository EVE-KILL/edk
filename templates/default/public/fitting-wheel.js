// Fitting Wheel initialization and interactivity
(function() {
    const fittingWheel = document.getElementById('fittingWheel');
    if (!fittingWheel) return;

    const tooltipOverlay = document.getElementById('tooltipOverlay');
    const tooltipName = document.getElementById('tooltipName');
    const tooltipValue = document.getElementById('tooltipValue');
    const tooltipStatus = document.getElementById('tooltipStatus');
    const shipContainer = fittingWheel.querySelector('.ship-container');

    let tooltipTimer = null;
    const HIDE_DELAY = 150;

    function formatNumber(num) {
        return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function getSlotPosition(slotType, slotIndex, totalSlots) {
        const radius = 42;
        let angle = 0;

        // Calculate angles for different slot types
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

        return {
            left: x + '%',
            top: y + '%',
        };
    }

    function getAmmoPosition(slotType) {
        // Ammo is positioned around the slot edge
        // Offset depends on slot type
        const smallRadius = 52; // Slightly larger radius than module slots
        let angle = 0;

        // Position ammo in sectors based on slot type
        switch (slotType) {
            case 'high':
                angle = -90; // Bottom
                break;
            case 'mid':
                angle = 0; // Right
                break;
            case 'low':
                angle = 90; // Top-right
                break;
            default:
                angle = 45;
        }

        const rad = angle * (Math.PI / 180);
        const x = 50 + smallRadius * Math.cos(rad);
        const y = 50 + smallRadius * Math.sin(rad);

        return {
            left: x + '%',
            top: y + '%',
        };
    }

    function showTooltip(slot) {
        if (tooltipTimer) {
            clearTimeout(tooltipTimer);
            tooltipTimer = null;
        }

        const name = slot.dataset.name;
        const price = parseFloat(slot.dataset.price) || 0;
        const quantity = parseInt(slot.dataset.quantity) || 1;
        const totalValue = price * quantity;
        const status = slot.dataset.status || 'destroyed';

        tooltipName.textContent = name;
        tooltipValue.textContent = formatNumber(totalValue) + ' ISK';
        tooltipStatus.textContent = status.charAt(0).toUpperCase() + status.slice(1);

        shipContainer.classList.add('darkened');
        tooltipOverlay.classList.remove('hidden');
    }

    function hideTooltip() {
        if (tooltipTimer) {
            clearTimeout(tooltipTimer);
        }

        tooltipTimer = setTimeout(() => {
            tooltipOverlay.classList.add('hidden');
            shipContainer.classList.remove('darkened');
        }, HIDE_DELAY);
    }

    // Position all slots
    const slots = fittingWheel.querySelectorAll('.slot');
    slots.forEach(slot => {
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
        }

        // Tooltip events for ammo container (lookup by flag)
        const ammoContainer = slot.querySelector('.ammo-container');
        if (ammoContainer) {
            ammoContainer.addEventListener('mouseenter', () => showTooltip(ammoContainer));
            ammoContainer.addEventListener('mouseleave', hideTooltip);
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
})();
