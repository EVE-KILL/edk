import { AsyncLocalStorage } from 'async_hooks';

export interface AlsContext {
  correlationId: string;
}

export const als = new AsyncLocalStorage<AlsContext>();
