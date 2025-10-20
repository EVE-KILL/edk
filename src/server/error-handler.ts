import { renderTemplate } from "./templates";
import type {} from "../../app/types/request.d"; // Import Request type extensions

// Cache environment variables
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";

/**
 * Error response helper
 * Renders appropriate error pages for HTML requests or JSON for API requests
 */
export async function createErrorResponse(
  req: Request,
  statusCode: number,
  message: string,
  details?: {
    stack?: string;
    path?: string;
    method?: string;
    timestamp?: string;
    description?: string;
  }
): Promise<Response> {
  const acceptsHtml = req.headers.get("accept")?.includes("text/html") ?? false;
  const url = req.parsedUrl || new URL(req.url); // Use pre-parsed URL if available

  if (acceptsHtml) {
    // Render HTML error page
    const templateMap: Record<number, string> = {
      401: "pages/401",
      403: "pages/403",
      404: "pages/404",
      500: "pages/500",
    };

    const template = templateMap[statusCode] || "pages/error";

    const data = {
      message,
      statusCode,
      currentUrl: url.pathname,
      isDevelopment: IS_DEVELOPMENT,
      ...details,
    };

    try {
      const html = await renderTemplate(template, data);
      return new Response(html, {
        status: statusCode,
        headers: { "Content-Type": "text/html" },
      });
    } catch (templateError) {
      // Fallback if template rendering fails
      console.error("Error rendering error template:", templateError);
      return createFallbackErrorResponse(statusCode, message, IS_DEVELOPMENT, details);
    }
  } else {
    // Return JSON for API requests
    const errorData: any = {
      error: getErrorName(statusCode),
      message,
      statusCode,
      path: details?.path || url.pathname,
    };

    // Add stack trace in development
    if (IS_DEVELOPMENT && details?.stack) {
      errorData.stack = details.stack;
      errorData.timestamp = details.timestamp;
    }

    return new Response(JSON.stringify(errorData, null, 2), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Get human-readable error name from status code
 */
function getErrorName(statusCode: number): string {
  const errorNames: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };

  return errorNames[statusCode] || "Error";
}

/**
 * Create a fallback error response if template rendering fails
 */
function createFallbackErrorResponse(
  statusCode: number,
  message: string,
  isDevelopment: boolean,
  details?: any
): Response {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error ${statusCode}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0a0a0a;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .error-container {
            max-width: 600px;
            text-align: center;
          }
          h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            color: #f44336;
          }
          p {
            font-size: 1.25rem;
            color: #ccc;
            margin-bottom: 2rem;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background: #333;
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
            margin: 0 8px;
          }
          .btn:hover {
            background: #555;
          }
          .debug-info {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 1rem;
            margin-top: 2rem;
            text-align: left;
            overflow-x: auto;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            color: #ff6b6b;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>Error ${statusCode}</h1>
          <p>${message}</p>
          ${
            isDevelopment && details?.stack
              ? `<div class="debug-info"><pre>${details.stack}</pre></div>`
              : ""
          }
          <div>
            <a href="/" class="btn">← Back to Home</a>
            <a href="javascript:history.back()" class="btn">Go Back</a>
          </div>
        </div>
      </body>
    </html>
  `;

  return new Response(html, {
    status: statusCode,
    headers: { "Content-Type": "text/html" },
  });
}
