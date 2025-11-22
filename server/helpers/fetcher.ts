/**
 * HTTP Fetcher Helper
 *
 * Wraps fetch with standardized headers, error handling, and retry logic
 * Used for all EVE-KILL and ESI API requests
 */

export interface FetcherOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

export interface FetcherResponse<T = any> {
  ok: boolean;
  status: number;
  statusText: string;
  data: T;
  headers: Headers;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 1;
const DEFAULT_USER_AGENT = 'EDK/0.1 (+https://eve-kill.com)';

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 10000);
}

/**
 * Fetcher helper - wraps fetch with standardized configuration
 *
 * Features:
 * - User-Agent header
 * - Timeout handling
 * - Automatic retries with exponential backoff
 * - JSON parsing
 * - Error handling
 */
export async function fetcher<T = any>(
  url: string,
  options: FetcherOptions = {}
): Promise<FetcherResponse<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
  } = options;

  const standardHeaders: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    ...headers,
  };

  // Add Content-Type for POST/PUT requests with body
  if (
    (method === 'POST' || method === 'PUT') &&
    body &&
    !standardHeaders['Content-Type']
  ) {
    standardHeaders['Content-Type'] = 'application/json';
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method,
          headers: standardHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Parse response body
        let data: T;
        try {
          data = await response.json();
        } catch {
          // If JSON parsing fails, return empty object
          data = {} as T;
        }

        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          data,
          headers: response.headers,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on client errors (4xx) except for rate limit (429)
      if (
        lastError.message.includes('404') ||
        lastError.message.includes('400')
      ) {
        throw lastError;
      }

      // Retry if we haven't exhausted retries
      if (attempt < retries) {
        const delay = getBackoffDelay(attempt);
        await sleep(delay);
        continue;
      }
    }
  }

  // If we got here, all retries failed
  throw lastError || new Error('Fetch failed after retries');
}
