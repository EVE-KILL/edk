/**
 * Event Client for Queue Workers
 *
 * Simple HTTP client for sending events to the management API
 * Used by queue workers and background processes to notify the web server
 * about important events (new killmails, statistics updates, etc.)
 */

const MANAGEMENT_API_URL = process.env.MANAGEMENT_API_URL || "http://127.0.0.1:3001";

export interface EventPayload {
  type: string;
  data?: any;
}

/**
 * Send an event to the management API
 *
 * @example
 * ```typescript
 * await sendEvent("killmail", {
 *   killmailId: 123456,
 *   timestamp: new Date()
 * });
 * ```
 */
export async function sendEvent(type: string, data?: any): Promise<void> {
  try {
    const response = await fetch(`${MANAGEMENT_API_URL}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type,
        data: data || {},
      } as EventPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorBody}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error("API returned success: false");
    }
  } catch (error) {
    // Log but don't throw - events are best-effort
    // Failing to send an event shouldn't crash the worker
    console.error(`[EventClient] Failed to send event '${type}':`, error);
  }
}

/**
 * Send event with retries for critical operations
 */
export async function sendEventWithRetry(
  type: string,
  data?: any,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendEvent(type, data);
      return; // Success
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt - 1))
        );
      }
    }
  }

  // All retries failed
  console.error(
    `[EventClient] Failed to send event '${type}' after ${maxRetries} attempts:`,
    lastError
  );
}
