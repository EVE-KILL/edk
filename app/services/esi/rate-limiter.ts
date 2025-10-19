/**
 * ESI Rate Limiter
 * Manages ESI error limits with progressive backoff
 */

interface RateLimitState {
  remainingErrors: number;
  resetTime: Date;
  isPaused: boolean;
  pauseUntil?: Date;
}

export class ESIRateLimiter {
  private state: RateLimitState = {
    remainingErrors: 100, // Default starting value
    resetTime: new Date(Date.now() + 60000), // 1 minute from now
    isPaused: false,
  };

  /**
   * Update rate limit state from ESI response headers
   */
  updateFromHeaders(headers: Headers): void {
    const remaining = headers.get("X-ESI-Error-Limit-Remain");
    const reset = headers.get("X-ESI-Error-Limit-Reset");

    if (remaining) {
      this.state.remainingErrors = parseInt(remaining);
    }

    if (reset) {
      this.state.resetTime = new Date(parseInt(reset) * 1000);
    }

    // Stop completely if we hit 1 error remaining
    if (this.state.remainingErrors <= 1) {
      this.pause(this.state.resetTime);
    }
  }

  /**
   * Calculate backoff delay based on remaining errors
   * Progressive backoff: more delay as we approach limit
   */
  getBackoffDelay(): number {
    const remaining = this.state.remainingErrors;

    // No delay if we have plenty of errors left
    if (remaining > 50) return 0;

    // Progressive backoff based on remaining errors
    if (remaining > 25) return 100; // 100ms
    if (remaining > 10) return 500; // 500ms
    if (remaining > 5) return 1000; // 1s
    if (remaining > 2) return 2000; // 2s
    if (remaining > 1) return 5000; // 5s

    // Stop at 1 error remaining - wait until reset time
    const now = Date.now();
    const resetTime = this.state.resetTime.getTime();
    return Math.max(0, resetTime - now);
  }

  /**
   * Pause requests until a specific time
   */
  pause(until: Date): void {
    this.state.isPaused = true;
    this.state.pauseUntil = until;
  }

  /**
   * Pause for a specific duration (in milliseconds)
   */
  pauseFor(ms: number): void {
    this.pause(new Date(Date.now() + ms));
  }

  /**
   * Check if we should wait before making a request
   * Returns delay in milliseconds (0 if no wait needed)
   */
  shouldWait(): number {
    // Check if we're paused
    if (this.state.isPaused && this.state.pauseUntil) {
      const now = Date.now();
      const pauseEnd = this.state.pauseUntil.getTime();

      if (now < pauseEnd) {
        return pauseEnd - now;
      }

      // Pause is over
      this.state.isPaused = false;
      this.state.pauseUntil = undefined;
    }

    // Return backoff delay
    return this.getBackoffDelay();
  }

  /**
   * Wait if necessary (with backoff or pause)
   */
  async waitIfNeeded(): Promise<void> {
    const delay = this.shouldWait();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  /**
   * Get current rate limit state
   */
  getState(): Readonly<RateLimitState> {
    return { ...this.state };
  }

  /**
   * Pause for 1 minute (used when ESI is down)
   */
  pauseForESIDown(): void {
    this.pauseFor(60000); // 1 minute
  }
}

// Global rate limiter instance (shared across all ESI requests)
export const esiRateLimiter = new ESIRateLimiter();
