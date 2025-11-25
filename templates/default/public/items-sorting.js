// Items table sorting per section
(function () {
  // Track sorting state per section
  const sortState = {};

  function initItemsSorting() {
    const sortHeaders = document.querySelectorAll('.section-sort-header .sortable');
    
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
          // New column, default to ascending (up arrow) for everything
          sortState[sectionIndex].sortBy = sortBy;
          sortState[sectionIndex].direction = 'asc';
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
    // Find all item rows in this section (between this header and the next section header)
    const itemRows = [];
    let currentRow = sectionRow.nextElementSibling;
    
    while (currentRow && !currentRow.classList.contains('section-sort-header') && 
           !currentRow.classList.contains('kb-table-header')) {
      if (currentRow.classList.contains('kb-table-row-odd') || 
          currentRow.classList.contains('kb-table-row-even')) {
        itemRows.push(currentRow);
      }
      currentRow = currentRow.nextElementSibling;
    }
    
    // Extract sort values and sort
    const sortedRows = itemRows.sort((a, b) => {
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
          // Status: destroyed = 1, dropped = 0 for sorting
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
    
    // Reinsert rows in sorted order (keep original styling)
    const insertAfter = sectionRow;
    sortedRows.forEach((row) => {
      insertAfter.parentNode.insertBefore(row, insertAfter.nextSibling);
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initItemsSorting);
  } else {
    initItemsSorting();
  }
})();
