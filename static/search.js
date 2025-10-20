// Global search functionality
(function() {
    const searchInput = document.getElementById('globalSearch');
    const searchResults = document.getElementById('searchResults');
    let searchTimeout = null;
    let currentRequest = null;

    if (!searchInput || !searchResults) {
        return;
    }

    // Debounce function
    function debounce(func, delay) {
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // Perform search
    async function performSearch(query) {
        if (query.trim().length < 2) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }

        // Cancel previous request if it exists
        if (currentRequest) {
            currentRequest.abort();
        }

        // Create new AbortController
        const controller = new AbortController();
        currentRequest = controller;

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`, {
                signal: controller.signal
            });
            
            if (!response.ok) {
                throw new Error('Search failed');
            }

            const data = await response.json();
            displayResults(data.results || []);
        } catch (error) {
            if (error.name === 'AbortError') {
                // Request was cancelled, ignore
                return;
            }
            console.error('Search error:', error);
            searchResults.innerHTML = '<div class="search-error">Search failed. Please try again.</div>';
            searchResults.style.display = 'block';
        } finally {
            currentRequest = null;
        }
    }

    // Display search results
    function displayResults(results) {
        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
            searchResults.style.display = 'block';
            return;
        }

        // Group results by type
        const grouped = {
            character: [],
            corporation: [],
            alliance: [],
            item: [],
            system: []
        };

        results.forEach(result => {
            if (grouped[result.type]) {
                grouped[result.type].push(result);
            }
        });

        let html = '';

        // Type labels
        const typeLabels = {
            character: 'Characters',
            corporation: 'Corporations',
            alliance: 'Alliances',
            item: 'Items',
            system: 'Systems'
        };

        // Type URLs
        const typeUrls = {
            character: '/character/',
            corporation: '/corporation/',
            alliance: '/alliance/',
            item: '/item/',
            system: '/system/'
        };

        // Build HTML for each type
        Object.keys(grouped).forEach(type => {
            if (grouped[type].length > 0) {
                html += `<div class="search-group">`;
                html += `<div class="search-group-header">${typeLabels[type]}</div>`;
                
                grouped[type].forEach(result => {
                    const url = typeUrls[type] + result.id;
                    const ticker = result.ticker ? ` [${result.ticker}]` : '';
                    const description = result.description ? `<span class="search-item-description">${result.description}</span>` : '';
                    
                    html += `<a href="${url}" class="search-item">`;
                    html += `<span class="search-item-name">${escapeHtml(result.name)}${ticker}</span>`;
                    if (description) {
                        html += description;
                    }
                    html += `</a>`;
                });
                
                html += `</div>`;
            }
        });

        searchResults.innerHTML = html;
        searchResults.style.display = 'block';
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Show results when clicking on input (if there are results)
    searchInput.addEventListener('click', function() {
        if (searchResults.innerHTML && searchInput.value.trim().length >= 2) {
            searchResults.style.display = 'block';
        }
    });

    // Clear results when input is cleared
    searchInput.addEventListener('input', function() {
        if (searchInput.value.trim().length === 0) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
        }
    });

    // Attach debounced search to input
    searchInput.addEventListener('input', debounce(function(e) {
        performSearch(e.target.value);
    }, 300));

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const items = searchResults.querySelectorAll('.search-item');
        if (items.length === 0) return;

        let currentIndex = -1;
        items.forEach((item, index) => {
            if (item.classList.contains('active')) {
                currentIndex = index;
            }
        });

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (currentIndex < items.length - 1) {
                if (currentIndex >= 0) {
                    items[currentIndex].classList.remove('active');
                }
                items[currentIndex + 1].classList.add('active');
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentIndex > 0) {
                items[currentIndex].classList.remove('active');
                items[currentIndex - 1].classList.add('active');
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentIndex >= 0) {
                items[currentIndex].click();
            }
        } else if (e.key === 'Escape') {
            searchResults.style.display = 'none';
        }
    });
})();
