/**
 * ESI Fetcher Helper
 *
 * Wraps fetch with ESI-specific logic, including rate limiting,
 * configurable server URLs, and error handling.
 */

import { fetcher, FetcherOptions, FetcherResponse } from './fetcher';
import { requestContext } from '../utils/request-context';
import { env } from './env';
import { als } from './als';
import {
  esiRateLimiter,
  getRateLimitGroup,
  getTokenCost,
} from './esi-rate-limiter';
import { logger } from './logger';

const ESI_SERVER = env.ESI_SERVER_URL;
let errorLimitRemain = 100;
let errorLimitReset = 60;
let errorsLastMinute = 0;
let lastErrorCheck = Date.now();
const requestQueue: (() => void)[] = [];
let isProcessing = false;

async function processQueue() {
  if (requestQueue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const nextRequest = requestQueue.shift();
  if (nextRequest) {
    nextRequest();
  }
}

const ERROR_LIMIT_REMAIN_THRESHOLD = 5;
const MAX_ERRORS_PER_MINUTE = 10;
const ERROR_CHECK_INTERVAL = 60000; // 1 minute

function canMakeRequest() {
  const now = Date.now();
  if (now - lastErrorCheck > ERROR_CHECK_INTERVAL) {
    errorsLastMinute = 0;
    lastErrorCheck = now;
  }
  return (
    errorLimitRemain > ERROR_LIMIT_REMAIN_THRESHOLD &&
    errorsLastMinute < MAX_ERRORS_PER_MINUTE
  );
}

export function fetchESI<T = any>(
  path: string,
  options: Omit<FetcherOptions, 'headers'> & {
    headers?: Record<string, string>;
  } = {}
): Promise<FetcherResponse<T>> {
  const performance = requestContext.getStore()?.performance;
  const spanId = performance?.startSpan(`ESI ${path}`, 'http', {
    path,
    method: options.method || 'GET',
  });

  const promise = new Promise<FetcherResponse<T>>((resolve, reject) => {
    const executeRequest = async () => {
      // Determine rate limit group for this path
      const rateLimitGroup = getRateLimitGroup(path);

      // Calculate delay based on token bucket state
      const delay = await esiRateLimiter.calculateDelay(rateLimitGroup, 2);
      if (delay > 0) {
        setTimeout(() => executeRequest(), delay);
        return;
      }

      // Check legacy error limit
      if (!canMakeRequest()) {
        setTimeout(() => executeRequest(), errorLimitReset * 1000);
        return;
      }

      const url = `${ESI_SERVER}/latest${path.startsWith('/') ? path : '/' + path}`;
      const store = als.getStore();
      const headers = { ...options.headers };
      if (store?.correlationId) {
        headers['x-correlation-id'] = store.correlationId;
      }

      try {
        const response = await fetcher<T>(url, { ...options, headers });

        // Update legacy error limit tracking
        const remain = response.headers.get('x-esi-error-limit-remain');
        const reset = response.headers.get('x-esi-error-limit-reset');

        if (remain) {
          errorLimitRemain = parseInt(remain, 10);
        }
        if (reset) {
          errorLimitReset = parseInt(reset, 10);
        }

        // Calculate token cost based on response status
        const tokenCost = getTokenCost(response.status);

        // Handle 429 rate limit
        if (response.status === 429) {
          errorsLastMinute++;
          const retryAfter = parseInt(
            response.headers.get('retry-after') || '60',
            10
          );

          // Update rate limiter state
          await esiRateLimiter.handleRateLimit(rateLimitGroup, retryAfter);

          // Retry after delay
          setTimeout(() => executeRequest(), retryAfter * 1000);
          return;
        }

        // Consume tokens for successful request
        await esiRateLimiter.consumeTokens(
          rateLimitGroup,
          tokenCost,
          response.headers
        );

        if (spanId) performance?.endSpan(spanId);
        resolve(response);
        setTimeout(processQueue, 100); // Small delay between requests
      } catch (error) {
        if (spanId) performance?.endSpan(spanId);
        reject(error);
        setTimeout(processQueue, 100);
      }
    };

    requestQueue.push(executeRequest);
    if (!isProcessing) {
      processQueue();
    }
  });

  return promise;
}
