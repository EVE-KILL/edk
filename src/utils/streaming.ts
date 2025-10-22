/**
 * Streaming Response Utilities
 *
 * Provides streaming capabilities for HTML and JSON responses
 * to reduce TTFB and improve perceived performance.
 */

/**
 * Create a streaming HTML response
 * Sends content progressively as it becomes available
 */
export function createStreamingHtmlResponse(
  headers: Headers = new Headers()
): {
  response: Response;
  writer: WritableStreamDefaultWriter<string>;
  write: (chunk: string) => Promise<void>;
  end: () => Promise<void>;
} {
  const encoder = new TextEncoder();

  let writer: WritableStreamDefaultWriter<Uint8Array>;

  const stream = new ReadableStream({
    start(controller) {
      writer = new WritableStream<string>({
        write(chunk) {
          controller.enqueue(encoder.encode(chunk));
        },
        close() {
          controller.close();
        },
        abort(reason) {
          controller.error(reason);
        }
      }).getWriter();
    }
  });

  // Set appropriate headers
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "text/html; charset=utf-8");
  }
  headers.set("Transfer-Encoding", "chunked");
  headers.set("X-Accel-Buffering", "no"); // Disable nginx buffering

  const response = new Response(stream, { headers });

  return {
    response,
    writer,
    write: async (chunk: string) => {
      await writer.write(chunk);
    },
    end: async () => {
      await writer.close();
    }
  };
}

/**
 * Create a streaming JSON response
 * Useful for large arrays or paginated data
 */
export function createStreamingJsonResponse(
  headers: Headers = new Headers()
): {
  response: Response;
  writeObject: (obj: any) => Promise<void>;
  writeArrayStart: () => Promise<void>;
  writeArrayItem: (item: any, isFirst: boolean) => Promise<void>;
  writeArrayEnd: () => Promise<void>;
  end: () => Promise<void>;
} {
  const encoder = new TextEncoder();
  let writer: WritableStreamDefaultWriter<Uint8Array>;

  const stream = new ReadableStream({
    start(controller) {
      writer = new WritableStream<string>({
        write(chunk) {
          controller.enqueue(encoder.encode(chunk));
        },
        close() {
          controller.close();
        },
        abort(reason) {
          controller.error(reason);
        }
      }).getWriter();
    }
  });

  // Set appropriate headers
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }
  headers.set("Transfer-Encoding", "chunked");
  headers.set("X-Accel-Buffering", "no");

  const response = new Response(stream, { headers });

  return {
    response,
    writeObject: async (obj: any) => {
      await writer.write(JSON.stringify(obj));
    },
    writeArrayStart: async () => {
      await writer.write("[");
    },
    writeArrayItem: async (item: any, isFirst: boolean) => {
      const prefix = isFirst ? "" : ",";
      await writer.write(prefix + JSON.stringify(item));
    },
    writeArrayEnd: async () => {
      await writer.write("]");
    },
    end: async () => {
      await writer.close();
    }
  };
}

/**
 * Stream an HTML template in chunks
 * Useful for large pages with multiple sections
 */
export async function streamHtmlTemplate(
  parts: {
    head: string;
    body: string;
    footer?: string;
  },
  headers: Headers = new Headers()
): Promise<Response> {
  const { response, write, end } = createStreamingHtmlResponse(headers);

  try {
    // Send the head immediately (CSS, meta tags, etc.)
    await write(parts.head);

    // Send body content
    await write(parts.body);

    // Send footer if provided
    if (parts.footer) {
      await write(parts.footer);
    }

    await end();
  } catch (error) {
    console.error("Streaming error:", error);
    // Stream is already started, can't change response
    // Just close the stream
    await end();
  }

  return response;
}

/**
 * Helper to split a rendered HTML page into streamable chunks
 * Splits at strategic points (after <head>, before </body>)
 */
export function splitHtmlForStreaming(html: string): {
  head: string;
  body: string;
  footer: string;
} {
  // Find the end of <head> tag
  const headEndIndex = html.indexOf("</head>");
  if (headEndIndex === -1) {
    // No head tag, stream everything as body
    return {
      head: "",
      body: html,
      footer: ""
    };
  }

  // Everything up to and including </head> and opening <body>
  const bodyStartIndex = html.indexOf("<body", headEndIndex);
  const bodyTagEndIndex = html.indexOf(">", bodyStartIndex) + 1;

  // Find the closing body tag
  const bodyEndIndex = html.lastIndexOf("</body>");

  if (bodyStartIndex === -1 || bodyEndIndex === -1) {
    // Malformed HTML, stream as-is
    return {
      head: html.substring(0, headEndIndex + 7),
      body: html.substring(headEndIndex + 7),
      footer: ""
    };
  }

  return {
    head: html.substring(0, bodyTagEndIndex),
    body: html.substring(bodyTagEndIndex, bodyEndIndex),
    footer: html.substring(bodyEndIndex)
  };
}

/**
 * Stream a paginated response
 * Fetches and streams data page by page
 */
export async function streamPaginatedResponse<T>(
  fetchPage: (page: number) => Promise<T[]>,
  totalPages: number,
  headers: Headers = new Headers()
): Promise<Response> {
  const { response, writeArrayStart, writeArrayItem, writeArrayEnd, end } =
    createStreamingJsonResponse(headers);

  try {
    await writeArrayStart();

    let isFirst = true;
    for (let page = 1; page <= totalPages; page++) {
      const items = await fetchPage(page);

      for (const item of items) {
        await writeArrayItem(item, isFirst);
        isFirst = false;
      }
    }

    await writeArrayEnd();
    await end();
  } catch (error) {
    console.error("Streaming pagination error:", error);
    await end();
  }

  return response;
}
