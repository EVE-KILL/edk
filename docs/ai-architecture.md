# AI Tools Architecture

## Overview

The AI tools system uses a modular, lazy-loading architecture to avoid circular dependencies while maintaining flexibility and ease of development.

## Directory Structure

```
server/
  ai/
    types.ts              # Shared TypeScript types
    tool-loader.ts        # Dynamic tool discovery and execution
    tools/                # Individual tool files
      show-killlist.ts    # Example: show recent kills
      (add more tools here - they auto-load!)

  routes/
    ai.get.ts            # AI chat page (SSR)
    api/
      ai/
        stream.post.ts   # SSE endpoint for AI streaming
```

## Key Design Principles

### 1. **No Circular Dependencies**

- Tools are NOT auto-imported by Nitro
- Tools are dynamically loaded only when executed
- Each tool imports what it needs (database, render, etc.) directly

### 2. **Easy to Add Tools**

Just create a new file in `server/ai/tools/` with this structure:

```typescript
import type { AITool, AIToolResult, AIToolContext } from '../types';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'your_tool_name',
    description: 'What your tool does',
    parameters: {
      type: 'object',
      properties: {
        // Your parameters
      },
    },
  },
};

export async function execute(
  args: any,
  context: AIToolContext
): Promise<AIToolResult> {
  const { database, render, logger } = context;

  // Your tool logic here
  // - Query database
  // - Render HTML
  // - Return results

  return {
    html: '<div>Your rendered output</div>',
    stats: {
      /* summary for AI */
    },
  };
}
```

### 3. **Tool Discovery**

- `tool-loader.ts` scans the `tools/` directory
- Converts underscores to hyphens (show_killlist → show-killlist.ts)
- Auto-discovers and loads tools on demand

### 4. **Execution Flow**

```
User Query → GET /api/ai/stream?query=...
  ↓
Get all tool definitions (lazy-load)
  ↓
Send to OpenAI with tools list
  ↓
AI decides which tool(s) to call
  ↓
Dynamic import of tool file
  ↓
Execute tool with context { database, render, logger }
  ↓
Stream HTML back to frontend via SSE
  ↓
Send stats to AI for contextual response
```

## API Endpoint

### GET /api/ai/stream

**Request:**

```
GET /api/ai/stream?query=Show+me+the+most+expensive+kills+today
```

**Response:** Server-Sent Events (SSE)

Event types:

- `tool_usage`: Shows which tools are being called
- `html`: Rendered HTML component
- `message`: AI's text response
- `error`: Error message
- `done`: Stream complete

## Performance Tracking

The new architecture:

- ✅ Maintains full performance tracking
- ✅ No circular dependency issues
- ✅ Tools can use all helpers (database, render, cache, etc.)
- ✅ Easy to debug - each tool is isolated

## Adding New Tools

1. Create `server/ai/tools/your-tool-name.ts`
2. Export `definition` and `execute` function
3. Import and register it in `tool-loader.ts`

Example:

```typescript
// In tool-loader.ts
import * as showKilllist from './tools/show-killlist';
import * as yourToolName from './tools/your-tool-name'; // Add import

const TOOLS: Record<string, AITool> = {
  'show-killlist': showKilllist as AITool,
  'your-tool-name': yourToolName as AITool, // Add to registry
};
```

No need to:

- ❌ Update switch statements
- ❌ Worry about circular dependencies

## Example: Adding a "Show Top Ships" Tool

```typescript
// server/ai/tools/show-top-ships.ts
import type { AITool, AIToolResult, AIToolContext } from '../types';

export const definition: AITool['definition'] = {
  type: 'function',
  function: {
    name: 'show_top_ships',
    description: 'Show most killed ship types',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number to show' },
      },
    },
  },
};

export async function execute(
  args: any,
  { database, render }: AIToolContext
): Promise<AIToolResult> {
  const sql = database.sql;

  const ships = await sql`
    SELECT 
      t.name,
      COUNT(*) as kills
    FROM killmails k
    JOIN types t ON k."victimShipTypeId" = t.type_id
    GROUP BY t.name
    ORDER BY kills DESC
    LIMIT ${args.limit || 10}
  `;

  return {
    html: `<div>${ships.map((s) => `${s.name}: ${s.kills}`).join('<br>')}</div>`,
    stats: { topShip: ships[0]?.name, totalTypes: ships.length },
  };
}
```

## Troubleshooting

**Tool not loading?**

- Check filename matches tool name (underscores → hyphens)
- Ensure `definition` and `execute` are exported

**Circular dependency errors?**

- Tools should be in `server/ai/tools/`, NOT `server/helpers/`
- Never use auto-imported globals - import explicitly

**Tool execution fails?**

- Check logs for tool name and args
- Verify context has database, render, logger
