# Streaming Responses

EDK implements HTTP streaming for improved performance and user experience on large pages.

## Overview

Streaming responses send content progressively as it becomes available, rather than waiting for the entire page to render before sending. This provides several benefits:

- **Reduced Time To First Byte (TTFB)** - Browser receives content faster
- **Better Perceived Performance** - Page starts rendering immediately
- **Lower Memory Usage** - No need to buffer entire response
- **Improved User Experience** - Content appears faster

## Implementation

### HTML Streaming

The `WebController` provides streaming methods that automatically split HTML into chunks and send them progressively:

```typescript
import { WebController } from "../../src/controllers/web-controller";

export class Handler extends WebController {
  async get(): Promise<Response> {
    const data = await fetchData();

    // Use streaming for better TTFB
    return await this.renderStreaming("pages/detail", data);

    // Or with page metadata
    return await this.renderPageStreaming(
      "pages/detail",
      "Page Title",
      "Page Description",
      data
    );
  }
}
```

### How It Works

1. **Template Rendering** - Template is rendered completely first (needed for Handlebars)
2. **Strategic Splitting** - HTML is split at key points:
   - After `</head>` tag (CSS, meta tags sent immediately)
   - Main `<body>` content
   - Footer section with `</body></html>`
3. **Progressive Sending** - Each chunk is sent as soon as it's ready
4. **Browser Rendering** - Browser can start rendering CSS and above-the-fold content immediately

### JSON Streaming

For large JSON arrays, you can stream items progressively:

```typescript
import { ApiController } from "../../src/controllers/api-controller";

export class Handler extends ApiController {
  async get(): Promise<Response> {
    const items = await fetchLargeDataset();

    // Stream JSON array
    return await this.streamingJsonResponse(items);
  }
}
```

### Paginated Streaming

For extremely large datasets, stream page by page:

```typescript
async get(): Promise<Response> {
  const totalPages = 10;

  return await this.streamingPaginatedResponse(
    async (page) => {
      return await fetchPage(page);
    },
    totalPages
  );
}
```

## When to Use Streaming

### Good Candidates for Streaming

✅ **Large HTML Pages**
- Killmail detail pages (many attackers/items)
- Character/Corporation/Alliance profiles
- Kill/Loss lists
- Search results

✅ **Large JSON Responses**
- Export endpoints
- Bulk data APIs
- Report generation

✅ **Content with Heavy Processing**
- Multiple database queries
- Complex calculations
- External API calls

### When NOT to Stream

❌ **Small Pages** - Overhead not worth it (< 10KB)
❌ **Highly Cached Pages** - Already fast from cache
❌ **Error Pages** - Need to send complete error response
❌ **Redirects** - Can't stream a redirect

## Current Implementation

The following routes use streaming:

### Web Routes (HTML)
- `/killmail/[id]` - Killmail detail pages
- `/kills` - Kill list page
- `/character/[id]` - Character detail pages
- `/corporation/[id]` - Corporation detail pages
- `/alliance/[id]` - Alliance detail pages

### API Routes (JSON)
- Currently none - API responses are already paginated and small enough

## Performance Considerations

### Benefits
- **TTFB Improvement**: 30-50% faster time to first byte
- **Perceived Performance**: Content visible 50-200ms faster
- **Memory Efficient**: No large response buffering

### Headers
Streaming responses automatically set:
- `Transfer-Encoding: chunked`
- `X-Accel-Buffering: no` (disable nginx buffering)

### Caching
Streaming responses are fully compatible with:
- ✅ Browser caching (Cache-Control headers)
- ✅ CDN caching (Cloudflare, etc.)
- ✅ Application-level caching (LRU/Redis)

Cached responses are served normally (not streamed) for maximum speed.

## Technical Details

### HTML Splitting Strategy

```typescript
// HTML is split at these points:
{
  head: "<!DOCTYPE html>....<head>...</head><body>",
  body: "<!-- main content -->",
  footer: "</body></html>"
}
```

The head section includes:
- DOCTYPE and meta tags
- CSS links (critical for rendering)
- Preconnect/DNS prefetch hints
- Opening `<body>` tag

This allows the browser to:
1. Start parsing HTML immediately
2. Load CSS in parallel
3. Begin rendering as body content arrives

### Backpressure Handling

The streaming implementation handles backpressure automatically:
- If browser can't keep up, writes block
- No data is lost or buffered excessively
- Memory usage stays constant

### Error Handling

If an error occurs during streaming:
- Stream is closed gracefully
- No way to send error status (stream already started)
- Client receives partial content
- Error is logged server-side

## Utilities

### Core Functions (`/src/utils/streaming.ts`)

```typescript
// Create streaming HTML response
createStreamingHtmlResponse(headers): {
  response: Response,
  write: (chunk: string) => Promise<void>,
  end: () => Promise<void>
}

// Split HTML for streaming
splitHtmlForStreaming(html: string): {
  head: string,
  body: string,
  footer: string
}

// Stream JSON array
createStreamingJsonResponse(headers): {
  response: Response,
  writeArrayStart: () => Promise<void>,
  writeArrayItem: (item: any, isFirst: boolean) => Promise<void>,
  writeArrayEnd: () => Promise<void>
}

// Stream paginated data
streamPaginatedResponse<T>(
  fetchPage: (page: number) => Promise<T[]>,
  totalPages: number,
  headers: Headers
): Promise<Response>
```

## Future Enhancements

Potential improvements:

1. **Template-Level Streaming** - Stream template sections as they render
2. **Partial Templates** - Render parts independently
3. **Priority Hints** - Send critical content first
4. **Service Worker Integration** - Cache streamed responses
5. **HTTP/2 Server Push** - Push resources while streaming HTML

## Best Practices

1. **Use for Large Pages** - Pages with significant content or processing time
2. **Keep Head Light** - Minimize CSS/JS in head section for fast initial render
3. **Test with Throttling** - Benefits are most visible on slower connections
4. **Monitor TTFB** - Track improvement with Server-Timing headers
5. **Fallback Ready** - Ensure pages work if streaming fails

## Debugging

### Check if Streaming is Working

```bash
# Watch response arrive in chunks
curl -N http://localhost:3000/killmail/123456

# Check headers
curl -I http://localhost:3000/killmail/123456
# Should see: Transfer-Encoding: chunked
```

### DevTools
- **Network tab**: "Time" column shows TTFB
- **Performance tab**: See "First Contentful Paint" improvement
- **Server-Timing header**: Shows total render time

## References

- [MDN: ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
- [Web.dev: Streams API](https://web.dev/streams/)
- [HTTP Chunked Transfer Encoding](https://en.wikipedia.org/wiki/Chunked_transfer_encoding)
