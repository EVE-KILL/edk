import { AsyncLocalStorage } from 'async_hooks';
import type { PerformanceTracker } from '../helpers/performance';

export interface RequestContext {
  performance: PerformanceTracker;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
