import { requestContext } from './request-context';
import type { SpanCategory } from '../helpers/performance';

/**
 * Decorator to automatically track method execution time
 *
 * Usage:
 * ```typescript
 * class MyModel {
 *   @tracked('application')
 *   async getKillmails() { ... }
 *
 *   @tracked('database', { customMetadata: 'value' })
 *   async saveKillmail() { ... }
 * }
 * ```
 */
export function tracked(
  category: SpanCategory = 'application',
  metadata?: Record<string, any>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const performance = requestContext.getStore()?.performance;

      if (!performance) {
        // No performance tracking active, just run the method
        return await originalMethod.apply(this, args);
      }

      const className = target.constructor?.name || 'Unknown';
      const name = `${className}.${propertyKey}`;

      return await performance.track(
        name,
        category,
        () => originalMethod.apply(this, args),
        metadata
      );
    };

    return descriptor;
  };
}

/**
 * Utility to track a code block without using decorators
 *
 * Usage:
 * ```typescript
 * const data = await track('fetch_killmails', 'http', async () => {
 *   return await fetchKillmails();
 * });
 * ```
 */
export async function track<T>(
  name: string,
  category: SpanCategory,
  fn: () => T | Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const performance = requestContext.getStore()?.performance;

  if (!performance) {
    // No performance tracking active, just run the function
    return await fn();
  }

  return await performance.track(name, category, fn, metadata);
}

/**
 * Legacy alias for track()
 * @deprecated Use track() instead
 */
export const trackBlock = track;

/**
 * Start tracking a span manually - returns a tracking ID
 * Use this when you need more control over when tracking starts/stops
 *
 * Usage:
 * ```typescript
 * const trackingId = startTracking('process_data', 'application');
 * try {
 *   // ... do work ...
 * } finally {
 *   endTracking(trackingId);
 * }
 * ```
 */
export function startTracking(
  name: string,
  category: SpanCategory,
  metadata?: Record<string, any>
): string | null {
  const performance = requestContext.getStore()?.performance;

  if (!performance) {
    return null;
  }

  const spanId = performance.startSpan(name, category, metadata);

  // Set as current span so children can inherit
  performance['currentSpanId'] = spanId;

  return spanId;
}

/**
 * End tracking for a span
 *
 * Usage:
 * ```typescript
 * const trackingId = startTracking('process_data', 'application');
 * // ... do work ...
 * endTracking(trackingId);
 * ```
 */
export function endTracking(trackingId: string | null): void {
  if (!trackingId) {
    return;
  }

  const performance = requestContext.getStore()?.performance;

  if (!performance) {
    return;
  }

  performance.endSpan(trackingId);

  // Clear current span ID if it matches
  if (performance['currentSpanId'] === trackingId) {
    performance['currentSpanId'] = undefined;
  }
}
