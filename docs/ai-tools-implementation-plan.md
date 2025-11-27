# AI Tools Implementation Plan

## Goal

Give the AI complete freedom to query and visualize EVE-KILL data safely.

---

## Phase 1: Display Components (Visual Tools)

### 1.1 **ai-killlist** Component

- Use existing killmail-list.hbs template (without filters/pagination)
- Accept array of killmail IDs
- Fetch and display in standard format

### 1.2 **ai-stat-card** Component

- Display a single stat with label/value
- Examples: "Total Kills: 1,234", "Average ISK: 5.2B"

### 1.3 **ai-stat-grid** Component

- Display multiple stats in a grid layout
- 2-4 columns, auto-wrapping

### 1.4 **ai-data-table** Component

- Generic table for query results
- Columns: configurable
- Rows: from query data

### 1.5 **ai-item-card** Component

- Show item image + name + description
- Similar to entity-card but for items/ships

### 1.6 **ai-chart** Component (Future)

- Bar chart, line chart, pie chart
- JSON data → visualization

---

## Phase 2: Safe Database Query Tool

### 2.1 **query_database** Tool

**Safety Restrictions:**

1. **READ ONLY** - Only SELECT statements
2. **Time limit** - 10 second query timeout
3. **Row limit** - Maximum 1000 rows returned
4. **No DDL/DML** - No CREATE, DROP, INSERT, UPDATE, DELETE
5. **No system tables** - Only app tables (killmails, characters, etc.)
6. **Sanitized output** - No raw errors, only safe messages

**Implementation:**

```typescript
// Whitelist of allowed tables
const ALLOWED_TABLES = [
  'killmails',
  'attackers',
  'items',
  'characters',
  'corporations',
  'alliances',
  'types',
  'groups',
  'categories',
  'mapSolarSystems',
  'mapRegions',
  'mapConstellations',
  'prices',
];

// Parse and validate query
function validateQuery(sql: string): boolean {
  // Must start with SELECT
  // Must not contain DROP, CREATE, INSERT, UPDATE, DELETE, TRUNCATE, ALTER
  // Must only reference allowed tables
  // Must not contain semicolons (multiple statements)
}
```

**Parameters:**

- `query` (string): SELECT statement
- `limit` (number): Row limit (default 100, max 1000)

**Output:**

- JSON: `{ columns: [...], rows: [...] }` or error

---

## Phase 3: Schema Introspection Tools

### 3.1 **get_database_schema** Tool

Returns high-level database structure.

**Output:**

```json
{
  "tables": {
    "killmails": {
      "description": "Core killmail data",
      "primaryKey": "killmailId",
      "commonFields": [
        "killmailId",
        "killmailTime",
        "solarSystemId",
        "totalValue",
        "victimCharacterId",
        "victimCorporationId",
        "victimShipTypeId"
      ],
      "relationships": ["attackers (killmailId)", "items (killmailId)"]
    },
    "characters": {
      "description": "Character entities",
      "primaryKey": "characterId",
      "commonFields": ["characterId", "name", "corporationId", "allianceId"]
    }
    // ... etc
  }
}
```

### 3.2 **get_table_schema** Tool

Get detailed schema for a specific table.

**Parameters:**

- `table` (string): Table name

**Output:**

```json
{
  "table": "killmails",
  "columns": [
    {"name": "killmailId", "type": "INTEGER", "nullable": false},
    {"name": "killmailTime", "type": "TIMESTAMP", "nullable": false},
    {"name": "solarSystemId", "type": "INTEGER", "nullable": true},
    // ...
  ],
  "indexes": [...],
  "sampleQuery": "SELECT \"killmailId\", \"killmailTime\", \"totalValue\" FROM killmails LIMIT 10"
}
```

---

## Phase 4: Data Visualization Tools

### 4.1 **render_killlist** Tool

Display killmails in standard list format.

**Parameters:**

- `killmailIds` (array of numbers): Killmail IDs to display
- `limit` (number): Max to show (default 10, max 50)

**Output:** HTML (uses existing killmail-list.hbs)

### 4.2 **render_stat_card** Tool

Display a single statistic.

**Parameters:**

- `label` (string): Stat label
- `value` (string/number): Stat value
- `color` (optional): 'green', 'red', 'blue', 'yellow'

**Output:** HTML card

### 4.3 **render_stat_grid** Tool

Display multiple statistics in a grid.

**Parameters:**

- `stats` (array): `[{label, value, color}, ...]`

**Output:** HTML grid

### 4.4 **render_data_table** Tool

Display query results as a table.

**Parameters:**

- `columns` (array): Column names
- `rows` (array): Row data
- `title` (optional): Table title

**Output:** HTML table

### 4.5 **render_item_card** Tool

Display item/ship with image.

**Parameters:**

- `typeId` (number): Item type ID
- `name` (string): Item name
- `description` (optional): Description text

**Output:** HTML card with EVE image

---

## Phase 5: Helper/Utility Tools

### 5.1 **get_killmail_ids** Tool

Get killmail IDs from query results.

**Parameters:**

- `filters` (object): Same as search_killmails

**Output:** JSON array of killmail IDs (no HTML)

### 5.2 **lookup_type_id** Tool

Get type ID by item name.

**Parameters:**

- `name` (string): Item/ship name

**Output:** `{typeId: number, name: string, groupName: string}`

### 5.3 **lookup_character_id** Tool

Get character ID by name (for queries).

**Parameters:**

- `name` (string): Character name

**Output:** `{characterId: number, name: string}`

---

## System Prompt Enhancement

```
You are an AI assistant for EVE-KILL with access to powerful database tools.

DATABASE SCHEMA:
- killmails: Core killmail data (killmailId, killmailTime, solarSystemId, totalValue, victimCharacterId, victimShipTypeId)
- attackers: Attacker data (killmailId, characterId, corporationId, allianceId, shipTypeId, finalBlow)
- items: Dropped items (killmailId, typeId, quantity, flag)
- characters: Character entities (characterId, name, corporationId, allianceId)
- corporations: Corporation entities (corporationId, name, ticker)
- alliances: Alliance entities (allianceId, name, ticker)
- types: Item/ship types (type_id, name, group_id)
- mapSolarSystems: Solar systems (system_id, name, region_id, security)

IMPORTANT COLUMN NAMING:
- Use "characterId" (camelCase with quotes in queries)
- Use "killmailId", "corporationId", "allianceId" (always camelCase)
- Use "killmailTime" for timestamps
- When writing SQL, wrap column names in double quotes: "killmailId"

AVAILABLE TOOLS:
1. query_database - Run SELECT queries (10s timeout, 1000 row limit)
2. get_database_schema - See all tables
3. get_table_schema - See table details
4. render_killlist - Display killmails
5. render_stat_grid - Display statistics
6. render_data_table - Display query results
7. render_item_card - Show ship/item with image
8. get_killmail_ids - Get IDs for rendering
9. lookup_* - Helper tools for IDs

WORKFLOW EXAMPLES:

User: "Show me the top 10 killers"
1. query_database: SELECT "characterId", COUNT(*) as kills FROM attackers GROUP BY "characterId" ORDER BY kills DESC LIMIT 10
2. For each character, lookup name
3. render_data_table with results

User: "Show me expensive titan losses"
1. lookup_type_id("Titan") → get titan type IDs
2. query_database: SELECT "killmailId" FROM killmails WHERE "victimShipTypeId" IN (titan_ids) AND "totalValue" > 50000000000 LIMIT 20
3. render_killlist(killmailIds)

ALWAYS:
- Wrap column names in double quotes in SQL
- Use proper table/column names (check schema first if unsure)
- Chain tools: query → process → visualize
- Show stats + details when possible
```

---

## Implementation Order

1. ✅ **Phase 1.1** - ai-killlist component (reuse existing)
2. ✅ **Phase 1.2-1.4** - Stat cards & data table components
3. ✅ **Phase 2.1** - Safe query_database tool
4. ✅ **Phase 3.1-3.2** - Schema introspection tools
5. ✅ **Phase 4** - All render\_\* tools
6. ✅ **Phase 5** - Helper tools
7. ✅ **System prompt** - Update with schema info

---

## Safety Measures

### SQL Injection Prevention

- Use parameterized queries
- Validate query structure with parser
- Whitelist allowed tables
- No string concatenation

### Resource Limits

- 10 second query timeout
- 1000 row limit
- Rate limiting per session
- No nested queries beyond 3 levels

### Error Handling

- Sanitize error messages
- No stack traces to AI
- Log all queries for audit
- Fail safely (no data exposure)

---

## Testing Plan

1. **Test safe queries:**
   - SELECT from allowed tables
   - JOINs between tables
   - GROUP BY, ORDER BY, LIMIT

2. **Test blocked queries:**
   - DROP, CREATE, INSERT, UPDATE, DELETE
   - System tables
   - Multiple statements (semicolons)
   - SQL injection attempts

3. **Test edge cases:**
   - Timeout handling
   - Large result sets
   - Malformed SQL
   - Unknown tables

---

## Success Criteria

✅ AI can answer: "Show me the top killers in Delve last week"  
✅ AI can answer: "What's the most expensive ship lost today?"  
✅ AI can answer: "Compare kills vs losses for Goonswarm"  
✅ AI cannot: DROP tables, access system data, run unsafe queries  
✅ All queries complete within 10 seconds  
✅ UI shows beautiful visualizations of data

---

**Status:** Ready to implement  
**Estimated Time:** 3-4 hours  
**Risk Level:** Medium (database access, but heavily restricted)
