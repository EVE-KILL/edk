# AI Tools System Guide

## Overview

The AI assistant has access to multiple tools that let it search, lookup, and display EVE Online data. It also maintains conversation history so users can ask follow-up questions.

## Available Tools

### 1. **show_killlist**

Display recent killmails with optional time filtering.

**Parameters:**

- `timeframe` (string): '1h', '6h', '24h', '7d', '30d', 'all'
- `limit` (number): Number of kills to show (max 50)

**Output:** HTML killmail list

**Example queries:**

- "Show me recent kills"
- "What happened in the last hour?"
- "Show me kills from the past week"

---

### 2. **show_expensive_kills**

Display the most expensive/valuable killmails.

**Parameters:**

- `timeframe` (string): Time period
- `limit` (number): Number to show (max 50)
- `minValue` (number): Minimum value in billions of ISK

**Output:** HTML killmail list sorted by value

**Example queries:**

- "Show me expensive kills today"
- "What are the biggest kills this week?"
- "Show kills worth more than 10 billion ISK"

---

### 3. **show_entity_info**

Display information about a character, corporation, or alliance.

**Parameters:**

- `entityType` (string): 'character', 'corporation', or 'alliance'
- `entityId` (number): ID of the entity
- `entityName` (string): Name to search for (if ID unknown)

**Output:** HTML entity card with stats

**Example queries:**

- "Tell me about Goonswarm Federation"
- "Show me information on Pandemic Legion"
- "Who is Chribba?"

---

### 4. **search_killmails**

Advanced killmail search with multiple filters.

**Parameters:**

- `characterId` (number): Filter by character
- `corporationId` (number): Filter by corporation
- `allianceId` (number): Filter by alliance
- `shipTypeId` (number): Filter by ship type
- `solarSystemId` (number): Filter by system
- `regionId` (number): Filter by region
- `minValue` (number): Minimum ISK value in billions
- `timeframe` (string): Time period
- `limit` (number): Number of results

**Output:** HTML filtered killmail list

**Example queries:**

- "Show me titan kills in Delve"
- "Find kills in Jita above 10 billion ISK"
- "Show Goonswarm's losses this week"

---

### OLD TOOLS (Not Yet Implemented)

### 5. **search_entity**

Search for characters, corporations, or alliances by name.

**Parameters:**

- `query` (string): Name to search for
- `type` (string): 'character', 'corporation', 'alliance', or 'any'

**Output:** HTML entity card with stats

**Example queries:**

- "Who is Karbowiak?"
- "Tell me about Goonswarm Federation"
- "Show me Pandemic Legion"

---

### 2. **lookup_ship**

Get information about a ship type.

**Parameters:**

- `query` (string): Ship name or type ID

**Output:** JSON data (ship info)

**Example queries:**

- "What is a Rifter?"
- "Tell me about the Titan"
- "What ship is type ID 587?"

---

### 3. **lookup_system**

Get solar system information.

**Parameters:**

- `query` (string): System name

**Output:** JSON data (system info, region, security status)

**Example queries:**

- "What is Jita?"
- "Tell me about the system Delve"
- "Where is 1DQ1-A?"

---

### 4. **lookup_region**

Get region information.

**Parameters:**

- `query` (string): Region name

**Output:** JSON data (region info)

**Example queries:**

- "What region is Delve?"
- "Tell me about The Forge"

---

### 5. **search_killmails**

Search killmails with complex filters.

**Parameters:**

- `characterId` (number): Filter by character
- `corporationId` (number): Filter by corporation
- `allianceId` (number): Filter by alliance
- `shipTypeId` (number): Filter by ship type
- `solarSystemId` (number): Filter by system
- `regionId` (number): Filter by region
- `minValue` (number): Minimum ISK value
- `maxValue` (number): Maximum ISK value
- `limit` (number): Number of results (default 10, max 50)

**Output:** HTML killmail list

**Example queries:**

- "Show me titan kills in Delve"
- "Find kills in Jita above 10 billion ISK"
- "Show me Goonswarm Federation's recent losses"

---

## Tool Chaining

The AI can use multiple tools together to answer complex questions:

**Example 1:**

```
User: "Show me titan kills in Delve"
AI:
  1. lookup_ship("Titan") → get titan type IDs
  2. lookup_region("Delve") → get region ID
  3. search_killmails(shipTypeId=..., regionId=...) → display kills
```

**Example 2:**

```
User: "Tell me about Karbowiak"
AI: search_entity(query="Karbowiak") → display entity card

User: "Show me his kills"
AI: search_killmails(characterId=268946627) → display killmails
```

---

## Conversation History

The AI maintains conversation context, so you can ask follow-up questions:

```
User: "Who is Karbowiak?"
AI: [Shows entity card]

User: "What alliance is he in?"
AI: "Karbowiak is in Fraternity. alliance"

User: "Show me their recent kills"
AI: search_killmails(allianceId=99003581) → [Shows kills]
```

---

## Information vs Display Tools

**Information Tools** (return JSON data):

- `lookup_ship`
- `lookup_system`
- `lookup_region`

These tools return data that the AI uses to answer questions. The AI processes the data and responds in natural language.

**Display Tools** (return HTML):

- `search_entity`
- `search_killmails`

These tools return rendered HTML components that are displayed directly to the user.

---

## Adding New Tools

To add a new tool:

1. **Define the tool schema** in `server/helpers/ai-tools.ts`:

```typescript
export const myNewTool = {
  type: 'function',
  function: {
    name: 'my_tool',
    description: 'What this tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: '...' },
      },
      required: ['param1'],
    },
  },
};
```

2. **Implement the executor**:

```typescript
async function executeMyTool(args: any) {
  // Do the work
  return { data: result }; // or { html: renderedHTML }
}
```

3. **Add to executeAITool switch**:

```typescript
case 'my_tool':
  return await executeMyTool(args);
```

4. **Add to availableTools array**:

```typescript
export const availableTools = [
  searchEntityTool,
  myNewTool, // Add here
];
```

---

## Complex Query Examples

### Entity + Killmails

```
"Show me The Mittani's titan losses"
→ search_entity("The Mittani")
→ lookup_ship("Titan")
→ search_killmails(characterId=..., shipTypeId=...)
```

### Region + Ship Type + Value

```
"Find 50+ billion ISK freighter kills in highsec"
→ lookup_ship("Freighter")
→ search_killmails(shipTypeId=..., minValue=50000000000, securityMin=0.5)
```

### Follow-up Context

```
User: "Who is Chribba?"
AI: [Shows entity card]

User: "Has he lost any ships?"
AI: [Uses characterId from previous response]
     search_killmails(characterId=127830891)
```

---

## Future Tool Ideas

- `get_top_killers`: Top entities by kills
- `get_top_losses`: Entities with most losses
- `lookup_item`: Get item/module information
- `search_battles`: Find major battles
- `get_entity_activity`: Activity timeline
- `compare_entities`: Compare stats between entities
- `get_system_activity`: Recent activity in a system

---

**Created**: 2025-11-26  
**Status**: Active - 5 tools implemented with conversation history
