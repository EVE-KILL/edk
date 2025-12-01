/**
 * Manual Test: ESI Rate Limiter Integration
 *
 * This script tests the ESI rate limiter by making actual requests to ESI.
 * Run with: bun run cli.ts test:esi-rate-limiter
 */

import { fetchESI } from '../../server/helpers/esi';
import { esiRateLimiter } from '../../server/helpers/esi-rate-limiter';
import { logger } from '../../server/helpers/logger';

export const description = 'Test ESI rate limiter with real ESI requests';

export async function action() {
  logger.info('🧪 Testing ESI Rate Limiter Integration...\n');

  // Test 1: Single killmail fetch
  logger.info('Test 1: Fetching a single killmail...');
  const killmailId = 123456789;
  const hash = 'test123';

  try {
    const response = await fetchESI(`/killmails/${killmailId}/${hash}/`);
    logger.info(`Response status: ${response.status}`);
    logger.info(
      `Headers: x-ratelimit-group=${response.headers.get('x-ratelimit-group')}, x-ratelimit-remaining=${response.headers.get('x-ratelimit-remaining')}`
    );
  } catch (error: any) {
    logger.error('Error fetching killmail:', error.message);
  }

  // Check rate limiter state
  const state = await esiRateLimiter.getStats('killmail');
  if (state) {
    logger.info('\nCurrent rate limiter state for "killmail" group:');
    logger.info(`  Tokens used: ${state.tokensUsed}/${state.maxTokens}`);
    logger.info(`  Tokens remaining: ${state.tokensRemaining}`);
    logger.info(
      `  Usage: ${((state.tokensUsed / state.maxTokens) * 100).toFixed(1)}%`
    );
    logger.info(
      `  Window: ${state.window}s (${Math.floor(state.window / 60)}min)`
    );
  } else {
    logger.warn('No rate limiter state found');
  }

  // Test 2: Burst of requests
  logger.info('\n\nTest 2: Making 5 rapid requests...');
  const testKillmails = [
    { id: 123456789, hash: 'abc123' },
    { id: 987654321, hash: 'def456' },
    { id: 111222333, hash: 'ghi789' },
    { id: 444555666, hash: 'jkl012' },
    { id: 777888999, hash: 'mno345' },
  ];

  const startTime = Date.now();
  for (const km of testKillmails) {
    logger.info(`  Fetching killmail ${km.id}...`);
    try {
      const response = await fetchESI(`/killmails/${km.id}/${km.hash}/`);
      logger.info(
        `    Status: ${response.status}, Remaining: ${response.headers.get('x-ratelimit-remaining')}`
      );
    } catch (error: any) {
      logger.warn(`    Error: ${error.message}`);
    }
  }
  const elapsed = Date.now() - startTime;
  logger.info(
    `\n  Completed 5 requests in ${elapsed}ms (${(elapsed / 5).toFixed(0)}ms avg per request)`
  );

  // Final state
  const finalState = await esiRateLimiter.getStats('killmail');
  if (finalState) {
    logger.info('\nFinal rate limiter state:');
    logger.info(
      `  Tokens used: ${finalState.tokensUsed}/${finalState.maxTokens}`
    );
    logger.info(`  Tokens remaining: ${finalState.tokensRemaining}`);
    logger.info(
      `  Usage: ${((finalState.tokensUsed / finalState.maxTokens) * 100).toFixed(1)}%`
    );
  }

  logger.success('\n✅ Test completed!');
  logger.info(
    '\nNote: Most requests will return 404 (not found) since we used fake killmail IDs.'
  );
  logger.info(
    'The important part is that the rate limiter is tracking token usage correctly.'
  );
}
