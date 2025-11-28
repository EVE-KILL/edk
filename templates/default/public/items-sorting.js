// Items table sorting per section
(function () {
  // Track sorting state per section
  const sortState = {};

  function initItemsSorting() {
    const sortHeaders = document.querySelectorAll('.section-sort-header .sortable');

    // Apply default sorting by name to all sections on page load
    const sectionHeaders = document.querySelectorAll('.section-sort-header');
    sectionHeaders.forEach((sectionRow) => {
      const sectionIndex = sectionRow.dataset.section;
      if (!sortState[sectionIndex]) {
        sortState[sectionIndex] = { sortBy: 'name', direction: 'asc' };
      }
      sortSection(sectionRow, 'name', 'asc');
      updateSortIndicators(sectionRow, 'name', 'asc');
    });

    sortHeaders.forEach(header => {
      header.addEventListener('click', function() {
        const sectionRow = this.closest('.section-sort-header');
        const sectionIndex = sectionRow.dataset.section;
        const sortBy = this.dataset.sort;

        // Initialize or toggle sort direction for this section
        if (!sortState[sectionIndex]) {
          sortState[sectionIndex] = { sortBy: null, direction: 'asc' };
        }

        // If clicking the same column, toggle direction
        if (sortState[sectionIndex].sortBy === sortBy) {
          sortState[sectionIndex].direction =
            sortState[sectionIndex].direction === 'asc' ? 'desc' : 'asc';
        } else {
          // New column - default direction depends on column type
          sortState[sectionIndex].sortBy = sortBy;
          // Numeric columns (quantity, price, totalValue) default to descending (largest first)
          // Text columns (name) default to ascending (A-Z)
          sortState[sectionIndex].direction =
            (sortBy === 'quantity' || sortBy === 'price' || sortBy === 'totalValue') ? 'desc' : 'asc';
        }

        // Update UI indicators
        updateSortIndicators(sectionRow, sortBy, sortState[sectionIndex].direction);

        // Sort the items in this section
        sortSection(sectionRow, sortBy, sortState[sectionIndex].direction);
      });
    });
  }

  function updateSortIndicators(sectionRow, activeSortBy, direction) {
    // Clear all indicators in this section
    sectionRow.querySelectorAll('.sort-indicator').forEach(indicator => {
      indicator.textContent = '';
      indicator.className = 'sort-indicator';
    });

    // Set the active indicator
    const activeHeader = sectionRow.querySelector(`[data-sort="${activeSortBy}"]`);
    if (activeHeader) {
      const indicator = activeHeader.querySelector('.sort-indicator');
      indicator.textContent = direction === 'asc' ? '▲' : '▼';
      indicator.className = 'sort-indicator active';
    }
  }

  function sortSection(sectionRow, sortBy, direction) {
    // Find all ROOT-LEVEL item rows in this section (exclude nested items)
    // Each root item may have nested items that need to move with it
    const itemGroups = [];
    let currentRow = sectionRow.nextElementSibling;

    while (currentRow && !currentRow.classList.contains('section-sort-header') &&
           !currentRow.classList.contains('kb-table-header')) {
      // Only process root-level items (not nested)
      if ((currentRow.classList.contains('kb-table-row-odd') ||
           currentRow.classList.contains('kb-table-row-even')) &&
          !currentRow.classList.contains('nested-item-row')) {

        // Collect this root item and all its nested items
        const group = { root: currentRow, nested: [] };

        // Check following rows for nested items
        let nextRow = currentRow.nextElementSibling;
        while (nextRow && nextRow.classList.contains('nested-item-row')) {
          group.nested.push(nextRow);
          nextRow = nextRow.nextElementSibling;
        }

        itemGroups.push(group);

        // Skip past nested items we just collected
        currentRow = nextRow || currentRow.nextElementSibling;
        continue;
      }
      currentRow = currentRow.nextElementSibling;
    }

    // Sort only by root item values (nested items stay with their parent)
    const sortedGroups = itemGroups.sort((a, b) => {
      let aValue, bValue;
      const aRoot = a.root;
      const bRoot = b.root;

      switch (sortBy) {
        case 'name':
          aValue = aRoot.querySelector('.item-name')?.textContent.trim().toLowerCase() || '';
          bValue = bRoot.querySelector('.item-name')?.textContent.trim().toLowerCase() || '';
          break;

        case 'quantity':
          aValue = parseInt(aRoot.dataset.quantity || '0');
          bValue = parseInt(bRoot.dataset.quantity || '0');
          break;

        case 'price':
          aValue = parseFloat(aRoot.dataset.price || '0');
          bValue = parseFloat(bRoot.dataset.price || '0');
          break;

        case 'totalValue':
          // Use the root item's total value (which includes nested items)
          aValue = parseFloat(aRoot.dataset.totalValue || '0');
          bValue = parseFloat(bRoot.dataset.totalValue || '0');
          break;

        case 'status':
          // Status: destroyed = 1, dropped = 0 for sorting
          aValue = aRoot.dataset.status === 'destroyed' ? 1 : 0;
          bValue = bRoot.dataset.status === 'destroyed' ? 1 : 0;
          break;

        default:
          return 0;
      }

      // Compare values
      let comparison = 0;
      if (typeof aValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = aValue - bValue;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    // Reinsert groups in sorted order (root item + all nested items together)
    let insertAfter = sectionRow;
    sortedGroups.forEach((group) => {
      // Insert root item
      insertAfter.parentNode.insertBefore(group.root, insertAfter.nextSibling);
      insertAfter = group.root;

      // Sort nested items within the container using the same sort criteria
      if (group.nested.length > 0) {
        const sortedNested = group.nested.sort((a, b) => {
          let aValue, bValue;

          switch (sortBy) {
            case 'name':
              aValue = a.querySelector('.item-name')?.textContent.trim().toLowerCase() || '';
              bValue = b.querySelector('.item-name')?.textContent.trim().toLowerCase() || '';
              break;

            case 'quantity':
              aValue = parseInt(a.dataset.quantity || '0');
              bValue = parseInt(b.dataset.quantity || '0');
              break;

            case 'price':
              aValue = parseFloat(a.dataset.price || '0');
              bValue = parseFloat(b.dataset.price || '0');
              break;

            case 'totalValue':
              aValue = parseFloat(a.dataset.totalValue || '0');
              bValue = parseFloat(b.dataset.totalValue || '0');
              break;

            case 'status':
              aValue = a.dataset.status === 'destroyed' ? 1 : 0;
              bValue = b.dataset.status === 'destroyed' ? 1 : 0;
              break;

            default:
              return 0;
          }

          // Compare values
          let comparison = 0;
          if (typeof aValue === 'string') {
            comparison = aValue.localeCompare(bValue);
          } else {
            comparison = aValue - bValue;
          }

          return direction === 'asc' ? comparison : -comparison;
        });

        // Insert sorted nested items immediately after the root
        sortedNested.forEach((nestedRow) => {
          insertAfter.parentNode.insertBefore(nestedRow, insertAfter.nextSibling);
          insertAfter = nestedRow;
        });
      }
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initItemsSorting);
  } else {
    initItemsSorting();
  }
})();
