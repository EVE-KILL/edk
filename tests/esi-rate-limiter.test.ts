import { describe, test, expect, beforeEach } from 'bun:test';
import {
  ESIRateLimiter,
  getRateLimitGroup,
  getTokenCost,
  RATE_LIMIT_GROUPS,
} from '../server/helpers/esi-rate-limiter';
import { storage } from '../server/helpers/redis';

describe('ESI Rate Limiter', () => {
  const rateLimiter = new ESIRateLimiter();

  beforeEach(async () => {
    // Clear all esi-rate-limit keys from Redis
    const keys = await storage.getKeys('esi-rate-limit');
    for (const key of keys) {
      await storage.removeItem(key);
    }
  });

  describe('getRateLimitGroup', () => {
    test('identifies killmail group', () => {
      expect(getRateLimitGroup('/killmails/123456/abc123def456/')).toBe(
        'killmail'
      );
      expect(getRateLimitGroup('/killmails/999/hash123/')).toBe('killmail');
    });

    test('falls back to default for unknown paths', () => {
      expect(getRateLimitGroup('/universe/types/34/')).toBe('default');
    });
  });

  describe('getTokenCost', () => {
    test('returns 2 tokens for 2XX responses', () => {
      expect(getTokenCost(200)).toBe(2);
      expect(getTokenCost(201)).toBe(2);
      expect(getTokenCost(204)).toBe(2);
    });

    test('returns 1 token for 3XX responses', () => {
      expect(getTokenCost(304)).toBe(1);
    });

    test('returns 5 tokens for 4XX responses except 429', () => {
      expect(getTokenCost(400)).toBe(5);
      expect(getTokenCost(404)).toBe(5);
      expect(getTokenCost(429)).toBe(0); // Rate limit doesn't cost tokens
    });

    test('returns 0 tokens for 5XX responses', () => {
      expect(getTokenCost(500)).toBe(0);
      expect(getTokenCost(502)).toBe(0);
    });
  });

  describe('Token Bucket State', () => {
    test('initializes state on first request', async () => {
      const state = await rateLimiter.getState('killmail');
      expect(state).toBeNull(); // No state yet

      // Calculate delay should initialize state
      const delay = await rateLimiter.calculateDelay('killmail', 2);
      expect(delay).toBe(0); // First request, no delay

      const newState = await rateLimiter.getState('killmail');
      expect(newState).not.toBeNull();
      expect(newState?.maxTokens).toBe(RATE_LIMIT_GROUPS.killmail.maxTokens);
      expect(newState?.tokensRemaining).toBe(
        RATE_LIMIT_GROUPS.killmail.maxTokens
      );
    });

    test('consumes tokens correctly', async () => {
      // Initialize
      await rateLimiter.calculateDelay('killmail', 2);

      // Consume 2 tokens
      await rateLimiter.consumeTokens('killmail', 2);

      const state = await rateLimiter.getState('killmail');
      expect(state?.tokensUsed).toBe(2);
      expect(state?.tokensRemaining).toBe(
        RATE_LIMIT_GROUPS.killmail.maxTokens - 2
      );
    });

    test('respects token limits', async () => {
      const testGroup = 'killmail';
      const maxTokens = RATE_LIMIT_GROUPS[testGroup].maxTokens;

      // Initialize
      await rateLimiter.calculateDelay(testGroup, 2);

      // Consume 95% of tokens to approach the limit
      const tokensToConsume = Math.floor(maxTokens * 0.95);
      for (let i = 0; i < tokensToConsume / 2; i++) {
        await rateLimiter.consumeTokens(testGroup, 2);
      }

      const state = await rateLimiter.getState(testGroup);
      const remainingPercent =
        (state!.tokensRemaining / state!.maxTokens) * 100;
      expect(remainingPercent).toBeLessThan(10); // Less than 10% remaining

      // Next request should have delay (in red/critical zone)
      const delay = await rateLimiter.calculateDelay(testGroup, 2);
      expect(delay).toBeGreaterThan(0);
    });

    test('handles 429 rate limit response', async () => {
      const retryAfter = 10; // 10 seconds

      await rateLimiter.handleRateLimit('killmail', retryAfter);

      const state = await rateLimiter.getState('killmail');
      expect(state?.retryAfter).toBeGreaterThan(Date.now());
      expect(state?.tokensRemaining).toBe(0);

      // Should delay until retry time
      const delay = await rateLimiter.calculateDelay('killmail', 2);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(retryAfter * 1000);
    });
  });

  describe('Backpressure', () => {
    test('applies no delay when tokens are plentiful', async () => {
      await rateLimiter.calculateDelay('killmail', 2);

      // Use only 10% of tokens
      const maxTokens = RATE_LIMIT_GROUPS.killmail.maxTokens;
      const tokensToUse = Math.floor(maxTokens * 0.1);
      for (let i = 0; i < tokensToUse / 2; i++) {
        await rateLimiter.consumeTokens('killmail', 2);
      }

      const delay = await rateLimiter.calculateDelay('killmail', 2);
      expect(delay).toBe(0); // No delay in green zone
    });

    test('applies delays when approaching limits', async () => {
      const testGroup = 'killmail';
      await rateLimiter.calculateDelay(testGroup, 2);

      // Use 85% of tokens (red zone)
      const maxTokens = RATE_LIMIT_GROUPS[testGroup].maxTokens;
      const tokensToUse = Math.floor(maxTokens * 0.85);
      for (let i = 0; i < tokensToUse / 2; i++) {
        await rateLimiter.consumeTokens(testGroup, 2);
      }

      const delay = await rateLimiter.calculateDelay(testGroup, 2);
      expect(delay).toBeGreaterThan(0); // Should have delay in red zone
    });
  });

  describe('Floating Window', () => {
    test('resets state after window expires', async () => {
      // Initialize state
      await rateLimiter.calculateDelay('killmail', 2);

      // Consume some tokens
      await rateLimiter.consumeTokens('killmail', 100);

      let state = await rateLimiter.getState('killmail');
      expect(state?.tokensUsed).toBe(100);

      // Manually expire the window by setting lastReset far in the past
      if (state) {
        state.lastReset = Date.now() - 1000 * 1000; // 1000 seconds ago
        await rateLimiter['setState']('killmail', state);
      }

      // Next calculation should reset
      await rateLimiter.calculateDelay('killmail', 2);

      state = await rateLimiter.getState('killmail');
      expect(state?.tokensUsed).toBe(0); // Reset
      expect(state?.tokensRemaining).toBe(RATE_LIMIT_GROUPS.killmail.maxTokens);
    });
  });
});
