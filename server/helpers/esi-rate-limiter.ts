/**
 * ESI Token Bucket Rate Limiter
 *
 * Implements ESI's token bucket rate limiting system with floating windows.
 * Each ESI route belongs to a rate limit group with specific token limits.
 *
 * Token costs per response status:
 * - 2XX: 2 tokens
 * - 3XX: 1 token (cached)
 * - 4XX: 5 tokens (error penalty)
 * - 5XX: 0 tokens (not penalized)
 * - 429: 0 tokens (rate limit)
 *
 * Reference: https://developers.eveonline.com/docs/services/esi/rate-limiting/
 */

import { storage } from './redis';
import { logger } from './logger';

/**
 * ESI Rate Limit Groups
 * From: https://gist.github.com/ErikKalkoken/63bf977d1fb6f9bc2de8c2d2776a885a
 */
export interface RateLimitGroup {
  maxTokens: number; // Maximum tokens per window
  window: number; // Window size in seconds
  avgDelay: number; // Average delay between requests in seconds
}

export const RATE_LIMIT_GROUPS: Record<string, RateLimitGroup> = {
  killmail: { maxTokens: 3600, window: 900, avgDelay: 0.5 },
  'char-killmail': { maxTokens: 30, window: 900, avgDelay: 60 },
  'corp-killmail': { maxTokens: 30, window: 900, avgDelay: 60 },
  'char-contract': { maxTokens: 600, window: 900, avgDelay: 3 },
  'char-detail': { maxTokens: 600, window: 900, avgDelay: 3 },
  'char-industry': { maxTokens: 600, window: 900, avgDelay: 3 },
  'char-location': { maxTokens: 1200, window: 900, avgDelay: 1.5 },
  'char-notification': { maxTokens: 15, window: 900, avgDelay: 120 },
  'char-social': { maxTokens: 600, window: 900, avgDelay: 3 },
  'char-wallet': { maxTokens: 150, window: 900, avgDelay: 12 },
  'corp-contract': { maxTokens: 600, window: 900, avgDelay: 3 },
  'corp-detail': { maxTokens: 300, window: 900, avgDelay: 6 },
  'corp-industry': { maxTokens: 600, window: 900, avgDelay: 3 },
  'corp-member': { maxTokens: 300, window: 900, avgDelay: 6 },
  'corp-social': { maxTokens: 300, window: 900, avgDelay: 6 },
  'corp-wallet': { maxTokens: 300, window: 900, avgDelay: 6 },
  routes: { maxTokens: 3600, window: 900, avgDelay: 0.5 },
  // Default fallback
  default: { maxTokens: 600, window: 900, avgDelay: 3 },
};

/**
 * Map ESI paths to rate limit groups
 */
export function getRateLimitGroup(path: string): string {
  // Killmails (allow any hash format, not just hex)
  if (path.match(/^\/killmails\/\d+\/[a-zA-Z0-9]+/i)) return 'killmail';
  if (path.match(/^\/characters\/\d+\/killmails\/recent\/?$/i))
    return 'char-killmail';
  if (path.match(/^\/corporations\/\d+\/killmails\/recent\/?$/i))
    return 'corp-killmail';

  // Characters
  if (path.match(/^\/characters\/\d+\/contracts/)) return 'char-contract';
  if (path.match(/^\/characters\/\d+\/(portrait|roles|titles|medals)/))
    return 'char-detail';
  if (path.match(/^\/characters\/\d+\/(industry|blueprints|agents_research)/))
    return 'char-industry';
  if (path.match(/^\/characters\/\d+\/(location|online|ship|fatigue|clones)/))
    return 'char-location';
  if (path.match(/^\/characters\/\d+\/notifications/))
    return 'char-notification';
  if (
    path.match(
      /^\/characters\/\d+\/(contacts|calendar|mail|standings|notifications\/contacts)/
    )
  )
    return 'char-social';
  if (path.match(/^\/characters\/\d+\/(wallet|loyalty_points)/))
    return 'char-wallet';

  // Corporations
  if (path.match(/^\/corporations\/\d+\/contracts/)) return 'corp-contract';
  if (
    path.match(
      /^\/corporations\/\d+\/(icons|medals|shareholders|titles|divisions)/
    )
  )
    return 'corp-detail';
  if (
    path.match(/^\/corporations\/\d+\/(industry|blueprints|mining|facilities)/)
  )
    return 'corp-industry';
  if (
    path.match(/^\/corporations\/\d+\/(members|roles|standings|membertracking)/)
  )
    return 'corp-member';
  if (path.match(/^\/corporations\/\d+\/contacts/)) return 'corp-social';
  if (path.match(/^\/corporations\/\d+\/wallets/)) return 'corp-wallet';

  // Routes
  if (path.match(/^\/route\/?$/)) return 'routes';

  return 'default';
}

/**
 * Calculate token cost based on HTTP status code
 */
export function getTokenCost(status: number): number {
  if (status >= 200 && status < 300) return 2; // 2XX
  if (status >= 300 && status < 400) return 1; // 3XX (cached)
  if (status >= 400 && status < 500 && status !== 429) return 5; // 4XX (error penalty)
  return 0; // 5XX or 429
}

/**
 * Token bucket state for a rate limit group
 */
interface TokenBucketState {
  tokensUsed: number;
  tokensRemaining: number;
  maxTokens: number;
  window: number;
  lastReset: number;
  retryAfter?: number; // Timestamp when we can retry (for 429 handling)
}

/**
 * ESI Rate Limiter
 */
export class ESIRateLimiter {
  private redisKeyPrefix = 'esi-rate-limit';
  private outboundIP: string | null = null;
  private ipDetectionPromise: Promise<string> | null = null;

  /**
   * Detect outbound IPv4 address using curl
   * Cached for the lifetime of the process
   * Forces IPv4 (-4 flag) to match ESI rate limiting behavior
   */
  private async detectOutboundIP(): Promise<string> {
    if (this.outboundIP) {
      return this.outboundIP;
    }

    // Prevent multiple simultaneous IP detection calls
    if (this.ipDetectionPromise) {
      return this.ipDetectionPromise;
    }

    this.ipDetectionPromise = (async () => {
      try {
        // Use curl with -4 to force IPv4
        const { exec } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execAsync = promisify(exec);

        const { stdout, stderr } = await execAsync(
          'curl -4 -s -m 5 https://api.ipify.org',
          { timeout: 5000 }
        );

        if (stderr) {
          throw new Error(stderr);
        }

        const ip = stdout.trim();
        if (!ip || !ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
          throw new Error('Invalid IPv4 address returned');
        }

        this.outboundIP = ip;
        logger.info(`[ESI Rate Limiter] Detected outbound IPv4: ${ip}`);
        return ip;
      } catch (error: any) {
        logger.warn(
          `[ESI Rate Limiter] Failed to detect outbound IP: ${error.message}`
        );
        // Fallback to 'unknown' if detection fails
        this.outboundIP = 'unknown';
        return 'unknown';
      } finally {
        this.ipDetectionPromise = null;
      }
    })();

    return this.ipDetectionPromise;
  }

  /**
   * Get Redis key for a rate limit group
   * Now includes IP address to track per-IP buckets
   */
  private async getRedisKey(group: string): Promise<string> {
    const ip = await this.detectOutboundIP();
    return `${this.redisKeyPrefix}:${ip}:${group}`;
  }

  /**
   * Get current state for a rate limit group
   */
  async getState(group: string): Promise<TokenBucketState | null> {
    const key = await this.getRedisKey(group);
    const data = await storage.getItemRaw(key); // Use getItemRaw to get the string directly
    if (!data) return null;

    try {
      // Data from setItemWithTTL is already JSON string
      const parsed =
        typeof data === 'string'
          ? JSON.parse(data)
          : (data as TokenBucketState);
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Save state for a rate limit group
   */
  private async setState(
    group: string,
    state: TokenBucketState
  ): Promise<void> {
    const key = await this.getRedisKey(group);
    const config = RATE_LIMIT_GROUPS[group] || RATE_LIMIT_GROUPS.default;

    // Store the state with TTL in one operation
    const ttlMs = (config.window + 60) * 1000;
    await storage.setItemWithTTL(key, state, ttlMs);
  }

  /**
   * Initialize state for a rate limit group
   */
  private initializeState(group: string): TokenBucketState {
    const config = RATE_LIMIT_GROUPS[group] || RATE_LIMIT_GROUPS.default;
    return {
      tokensUsed: 0,
      tokensRemaining: config.maxTokens,
      maxTokens: config.maxTokens,
      window: config.window,
      lastReset: Date.now(),
    };
  }

  /**
   * Check if we need to reset the bucket (window expired)
   */
  private shouldReset(state: TokenBucketState): boolean {
    const elapsed = Date.now() - state.lastReset;
    return elapsed >= state.window * 1000;
  }

  /**
   * Calculate delay before making a request based on token availability
   * Returns delay in milliseconds
   */
  async calculateDelay(group: string, tokenCost: number = 2): Promise<number> {
    let state = await this.getState(group);

    // Initialize if no state exists
    if (!state) {
      state = this.initializeState(group);
      await this.setState(group, state);
    }

    // Reset if window expired
    if (this.shouldReset(state)) {
      state = this.initializeState(group);
      await this.setState(group, state);
    }

    // Check if we're under rate limit (429)
    if (state.retryAfter && Date.now() < state.retryAfter) {
      const delay = state.retryAfter - Date.now();
      logger.warn(
        `[ESI Rate Limiter] Group ${group} is rate-limited, waiting ${Math.ceil(delay / 1000)}s`
      );
      return delay;
    }

    // Calculate remaining tokens
    const tokensRemaining = state.tokensRemaining;
    const usagePercent = (state.tokensUsed / state.maxTokens) * 100;

    // Not enough tokens available
    if (tokensRemaining < tokenCost) {
      // Calculate time until tokens are available
      // In a floating window, tokens consumed are returned after window passes
      // For simplicity, wait until next window reset
      const elapsed = Date.now() - state.lastReset;
      const timeUntilReset = state.window * 1000 - elapsed;

      logger.warn(
        `[ESI Rate Limiter] Group ${group} insufficient tokens (${tokensRemaining}/${state.maxTokens}), waiting ${Math.ceil(timeUntilReset / 1000)}s`
      );
      return Math.max(timeUntilReset, 0);
    }

    // Apply backpressure based on token availability
    // Green zone (>50% tokens): No delay
    if (usagePercent < 50) {
      return 0;
    }

    // Yellow zone (50-80% tokens): Small delays
    if (usagePercent < 80) {
      const delay = Math.floor(Math.random() * 500) + 100; // 100-600ms
      return delay;
    }

    // Red zone (80-95% tokens): Larger delays
    if (usagePercent < 95) {
      const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3s
      return delay;
    }

    // Critical zone (>95% tokens): Conservative delays
    const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5s
    return delay;
  }

  /**
   * Consume tokens for a request
   */
  async consumeTokens(
    group: string,
    tokenCost: number,
    headers?: Headers
  ): Promise<void> {
    let state = await this.getState(group);

    if (!state) {
      state = this.initializeState(group);
    }

    // Reset if window expired
    if (this.shouldReset(state)) {
      state = this.initializeState(group);
    }

    // Update from ESI headers if available
    if (headers) {
      const remaining = headers.get('x-ratelimit-remaining');
      const used = headers.get('x-ratelimit-used');

      if (remaining !== null) {
        state.tokensRemaining = parseInt(remaining, 10);
      }

      if (used !== null) {
        const usedTokens = parseInt(used, 10);
        state.tokensUsed += usedTokens;
        state.tokensRemaining = state.maxTokens - state.tokensUsed;
      } else {
        // Fallback: use calculated token cost
        state.tokensUsed += tokenCost;
        state.tokensRemaining = Math.max(0, state.tokensRemaining - tokenCost);
      }
    } else {
      // No headers, use calculated cost
      state.tokensUsed += tokenCost;
      state.tokensRemaining = Math.max(0, state.tokensRemaining - tokenCost);
    }

    await this.setState(group, state);

    // Log if approaching limits
    const usagePercent = (state.tokensUsed / state.maxTokens) * 100;
    if (usagePercent >= 80) {
      logger.warn(
        `[ESI Rate Limiter] Group ${group} at ${usagePercent.toFixed(1)}% capacity (${state.tokensRemaining}/${state.maxTokens} tokens remaining)`
      );
    }
  }

  /**
   * Handle 429 rate limit response
   */
  async handleRateLimit(group: string, retryAfter: number): Promise<void> {
    let state = await this.getState(group);

    if (!state) {
      state = this.initializeState(group);
    }

    // Set retry timestamp
    state.retryAfter = Date.now() + retryAfter * 1000;
    state.tokensRemaining = 0; // No tokens available

    await this.setState(group, state);

    logger.error(
      `[ESI Rate Limiter] Group ${group} received 429, retry after ${retryAfter}s`
    );
  }

  /**
   * Get current statistics for monitoring
   */
  async getStats(group: string): Promise<TokenBucketState | null> {
    return this.getState(group);
  }
}

// Singleton instance
export const esiRateLimiter = new ESIRateLimiter();
