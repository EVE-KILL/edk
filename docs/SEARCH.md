# Global Search Feature

## Overview
Implemented a global search feature that searches across multiple entity types in real-time as the user types.

## Components

### 1. API Endpoint (`/app/routes/api/search.ts`)
- **Endpoint**: `GET /api/search?q=<query>&limit=<number>`
- **Minimum query length**: 2 characters
- **Searches across**:
  - Characters (by name)
  - Corporations (by name or ticker)
  - Alliances (by name or ticker)
  - Items/Types (by name)
  - Solar Systems (by name)
- **Features**:
  - Results sorted by relevance (exact match → starts with → contains)
  - Configurable result limit (default: 10, max in UI: 20)
  - Returns JSON with type, id, name, ticker (if applicable), and description

### 2. Search UI (`templates/layouts/main.hbs`)
- Search box positioned below the navigation bar
- Centered with max-width of 600px
- Matches EDK theme styling (dark background, blue highlights)
- Responsive dropdown for results
- Grouped by entity type

### 3. JavaScript (`/static/search.js`)
- **Debounced search**: 300ms delay to reduce API calls
- **Auto-complete**: Results appear as you type
- **Keyboard navigation**:
  - Arrow Up/Down to navigate results
  - Enter to select
  - Escape to close
- **Click outside**: Closes dropdown when clicking outside
- **Request cancellation**: Aborts previous requests when typing
- **XSS protection**: HTML escaping for displayed content

## Performance Considerations

### Current Implementation
- Uses SQLite LIKE queries with indexed columns
- Should handle moderate data sizes (thousands to tens of thousands of records)
- Indexes already exist on name columns for most tables

### If Performance Becomes an Issue
Consider these options:

1. **SQLite FTS5 (Full-Text Search)**
   - Create virtual tables with FTS5
   - Much faster for text search
   - Built into SQLite, no external dependencies
   - Example:
   ```sql
   CREATE VIRTUAL TABLE characters_fts USING fts5(name, content=characters);
   ```

2. **Meilisearch**
   - Fast, typo-tolerant search engine
   - Requires separate process
   - Great for large datasets
   - Can sync with SQLite

3. **Typesense**
   - Similar to Meilisearch
   - Self-hosted option
   - Good TypeScript support

4. **Orama (formerly Lyra)**
   - JavaScript-based search engine
   - Can run in-process with Bun
   - Good for smaller datasets
   - NPM package: `@orama/orama`

## Usage

1. Type at least 2 characters in the search box
2. Results appear automatically after 300ms
3. Click on a result to navigate to that entity's page
4. Results are grouped by type (Characters, Corporations, etc.)

## Future Enhancements

- [ ] Search result caching
- [ ] Recent searches
- [ ] Search suggestions/autocomplete
- [ ] Fuzzy matching for typos
- [ ] Advanced filters (entity type, security status, etc.)
- [ ] Search history
- [ ] Keyboard shortcuts (e.g., Ctrl+K to focus search)
- [ ] Add regions and constellations when those tables are created
