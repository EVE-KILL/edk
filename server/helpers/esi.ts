/**
 * ESI Fetcher Helper
 *
 * Wraps fetch with ESI-specific logic, including rate limiting,
 * configurable server URLs, and error handling.
 */

import { fetcher, FetcherOptions, FetcherResponse } from './fetcher';
import { requestContext } from '../utils/request-context';

const ESI_SERVER = process.env.ESI_SERVER_URL || 'https://esi.evetech.net';
let errorLimitRemain = 100;
let errorLimitReset = 60;
let errorsLastMinute = 0;
let lastErrorCheck = Date.now();
let requestQueue: (() => void)[] = [];
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
  const spanId = performance?.startSpan(
    `ESI ${path}`,
    'http',
    { path, method: options.method || 'GET' }
  );

  const promise = new Promise<FetcherResponse<T>>((resolve, reject) => {
    const executeRequest = async () => {
      if (!canMakeRequest()) {
        setTimeout(() => executeRequest(), errorLimitReset * 1000);
        return;
      }

      const url = `${ESI_SERVER}/latest${path.startsWith('/') ? path : '/' + path}`;

      try {
        const response = await fetcher<T>(url, options);

        const remain = response.headers.get('x-esi-error-limit-remain');
        const reset = response.headers.get('x-esi-error-limit-reset');

        if (remain) {
          errorLimitRemain = parseInt(remain, 10);
        }
        if (reset) {
          errorLimitReset = parseInt(reset, 10);
        }

        if (response.status === 429) {
          errorsLastMinute++;
          const retryAfter = response.headers.get('retry-after') || '10';
          setTimeout(() => executeRequest(), parseInt(retryAfter, 10) * 1000);
          return;
        }

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
