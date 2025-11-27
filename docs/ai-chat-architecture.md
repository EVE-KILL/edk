# AI Chat Architecture

## Overview

The AI chat system uses **Server-Sent Events (SSE)** to stream AI responses while keeping all template rendering on the backend. This preserves EDK's SSR architecture while enabling real-time AI interactions.

## Architecture Flow

```
User Query → /api/ai/stream (SSE) → AI Processing → Render Template → Stream HTML → Frontend Display
```

### Key Benefits

- ✅ **Pure SSR** - All templates stay on backend
- ✅ **Progressive rendering** - Stream status updates and HTML chunks
- ✅ **No client-side templates** - Handlebars stays server-side only
- ✅ **Real-time updates** - Show AI thinking/progress states
- ✅ **Nitro native** - Uses `createEventStream()` from h3

## File Structure

All AI-related templates are prefixed with `ai-` for easy identification:

```
templates/default/
├── pages/
│   └── ai.hbs                          # Main chat page
├── components/
│   ├── ai-input-area.hbs               # Chat input form with examples
│   └── ai-killmail-list.hbs            # Killmail results component
└── partials/
    ├── ai-welcome-message.hbs          # Welcome/intro message
    └── ai-chat-client.hbs              # Client-side SSE handler

server/routes/
├── ai.get.ts                           # GET /ai - Chat page
└── api/ai/
    └── stream.get.ts                   # GET /api/ai/stream - SSE endpoint
```

## How It Works

### 1. User visits `/ai`

- `server/routes/ai.get.ts` renders `pages/ai.hbs`
- Page loads with welcome message and input form
- Client-side JS from `partials/ai-chat-client.hbs` is ready

### 2. User submits query

Client opens SSE connection:

```javascript
const eventSource = new EventSource(
  `/api/ai/stream?query=${encodeURIComponent(query)}`
);
```

### 3. Server processes via SSE

```typescript
// server/routes/api/ai/stream.get.ts
const eventStream = createEventStream(event);

// Send thinking status
await eventStream.push({
  event: 'status',
  data: JSON.stringify({ status: 'thinking', message: 'Analyzing...' }),
});

// Call AI with tools (TODO: OpenRouter integration)
// Execute tool calls (search DB, get stats, etc.)

// Render component server-side
const html = await render(
  'components/ai-killmail-list',
  {},
  { killmails },
  undefined,
  false
);

// Stream HTML back
await eventStream.push({
  event: 'html',
  data: html,
});

await eventStream.close();
```

### 4. Client receives events

```javascript
eventSource.addEventListener('status', (e) => {
  // Show thinking/searching state
  contentEl.innerHTML = `<div>Analyzing...</div>`;
});

eventSource.addEventListener('html', (e) => {
  // Inject rendered HTML
  contentEl.innerHTML = e.data;
});

eventSource.addEventListener('done', (e) => {
  eventSource.close();
});
```

## SSE Event Types

| Event    | Data Format              | Purpose                   |
| -------- | ------------------------ | ------------------------- |
| `status` | `{ status, message }`    | Show AI thinking/progress |
| `html`   | Raw HTML string          | Inject rendered component |
| `error`  | `{ error, message }`     | Handle errors             |
| `done`   | `{ status: 'complete' }` | Signal completion         |

## Current Implementation

### Mock Demo (No AI Yet)

The current implementation demonstrates the architecture without actual AI:

1. User submits query
2. Server sends "thinking" status
3. Server fetches 5 recent killmails from DB
4. Server renders `ai-killmail-list` component
5. Server streams HTML to client
6. Client displays results

### Next Steps: AI Integration

To add real AI capabilities:

1. **Add OpenRouter SDK**:

   ```bash
   bun add openai  # OpenRouter uses OpenAI SDK
   ```

2. **Define Tools** in `server/helpers/ai-tools.ts`:

   ```typescript
   export const searchKillmails = {
     type: 'function',
     function: {
       name: 'search_killmails',
       description: 'Search killmails by filters',
       parameters: {
         type: 'object',
         properties: {
           startDate: { type: 'string' },
           endDate: { type: 'string' },
           systemId: { type: 'number' },
           // ... more filters
         },
       },
     },
   };
   ```

3. **Update SSE endpoint** to call OpenRouter:

   ```typescript
   const response = await openRouter.chat.completions.create({
     model: 'anthropic/claude-3.5-sonnet',
     messages: [{ role: 'user', content: userQuery }],
     tools: [searchKillmails, getEntityStats /* ... */],
     stream: true,
   });

   for await (const chunk of response) {
     if (chunk.choices[0].delta.tool_calls) {
       // Execute tool
       const result = await executeTool(chunk.choices[0].delta.tool_calls[0]);

       // Render appropriate component with result
       const html = await renderAIComponent(
         'components/ai-killmail-list',
         result
       );

       await eventStream.push({ event: 'html', data: html });
     }
   }
   ```

## Adding New AI Components

To add a new renderable component:

1. **Create template**: `templates/default/components/ai-[name].hbs`
2. **Add tool definition** that returns data matching component
3. **Add rendering logic** in SSE endpoint
4. Component automatically gets all Handlebars helpers

Example - Top killers component:

```handlebars
<!-- templates/default/components/ai-top-killers.hbs -->
{{#if killers}}
  <h3>Top Killers</h3>
  <ul>
    {{#each killers}}
      <li>{{this.name}} - {{formatNumber this.kills}} kills</li>
    {{/each}}
  </ul>
{{/if}}
```

## Testing

### Manual Test

1. Visit http://localhost:3000/ai
2. Enter a query (e.g., "Show me recent kills")
3. Verify:
   - Thinking animation appears
   - Status updates show
   - Killmails render correctly
   - Links work

### SSE Test with curl

```bash
curl -N http://localhost:3000/api/ai/stream?query=test
```

Should stream:

```
event: status
data: {"status":"thinking","message":"Analyzing your query..."}

event: status
data: {"status":"searching","message":"Searching killmails..."}

event: html
data: <div>...rendered HTML...</div>

event: done
data: {"status":"complete"}
```

## Performance Considerations

- **Template caching**: Production mode caches compiled templates
- **Component rendering**: ~5-10ms per component render
- **SSE overhead**: Minimal, native browser support
- **Database queries**: Same as normal killmail queries
- **AI latency**: Will add ~1-3s for OpenRouter calls (when integrated)

## Security

- Input sanitization via `escapeHtml()` client-side
- Query params URL-encoded
- CORS enabled for `/api/**` routes
- No user data sent to AI (when integrated, be mindful)

## Future Enhancements

1. **Chat history**: Store conversation in session
2. **Multi-step queries**: "Show titans, now filter to last week"
3. **Streaming text**: Stream AI explanations word-by-word
4. **Voice input**: Web Speech API integration
5. **Saved queries**: User can save/share queries
6. **Query suggestions**: Based on popular queries

---

**Created**: 2025-11-26  
**Status**: Proof of Concept (No AI integration yet)  
**Next**: Add OpenRouter + tool calling
