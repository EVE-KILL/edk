import { logger } from "../../../src/utils/logger";

/**
 * ESI Rate Limiter
 *
 * Manages rate limits for EVE Online ESI API calls
 * EVE Online provides rate limiting headers that we track
 */
export class ESIRateLimiter {
  private remainingRequests = 100;
  private resetTime = Date.now() + 60000; // 60 seconds from now
  private errorBudget = 0;
  private lastReset = Date.now();

  /**
   * Check if we can make a request
   * Returns false if rate limit exceeded
   */
  canMakeRequest(): boolean {
    this.checkReset();
    return this.remainingRequests > 0;
  }

  /**
   * Wait until we can make another request
   */
  async waitIfNeeded(): Promise<void> {
    while (!this.canMakeRequest()) {
      const waitTime = this.resetTime - Date.now();
      logger.warn(`Rate limited, waiting ${Math.ceil(waitTime / 1000)}s`);
      await this.sleep(Math.min(waitTime, 5000)); // Wait max 5 seconds before checking again
    }
  }

  /**
   * Update rate limit from response headers
   */
  updateFromHeaders(headers: Headers): void {
    const remaining = headers.get("X-Esi-Error-Limit-Remain");
    const reset = headers.get("X-Esi-Error-Limit-Reset");

    if (remaining !== null) {
      this.errorBudget = parseInt(remaining);
    }

    if (reset !== null) {
      this.resetTime = parseInt(reset) * 1000;
    }

    // Decrement remaining for this request
    this.remainingRequests--;
  }

  /**
   * Check if we need to reset rate limit
   */
  private checkReset(): void {
    if (Date.now() >= this.resetTime) {
      this.remainingRequests = 100; // ESI default limit
      this.resetTime = Date.now() + 60000;
      this.lastReset = Date.now();
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      remaining: this.remainingRequests,
      resetAt: new Date(this.resetTime),
      errorBudget: this.errorBudget,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const esiRateLimiter = new ESIRateLimiter();
