import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNextInterval } from '../sync/adaptive';

describe('Multi-Tenant Isolation & Adaptive Sync Boundaries', () => {
  it('evaluates rate-limit backoff strictly per input state without cross-tenant bleed', () => {
    // User A on a normal healthy Canvas instance
    const userAEval = calculateNextInterval({
      currentInterval: 60,
      consecutiveSuccesses: 5,
      rateLimitRemaining: 550,
      is429: false,
    });
    assert.equal(userAEval.currentIntervalSeconds, 60);
    assert.equal(userAEval.rateLimitStatus, 'healthy');
    assert.equal(userAEval.backoffSeconds, 0);
    assert.equal(userAEval.backoffUntil, null);

    // User B encountering a 429 throttled instance with a 30s Retry-After
    const userBEval = calculateNextInterval({
      currentInterval: 60,
      consecutiveSuccesses: 0,
      is429: true,
      retryAfterSec: 30,
    });
    assert.equal(userBEval.rateLimitStatus, 'throttled');
    assert.equal(userBEval.backoffSeconds, 30);
    assert.ok(userBEval.backoffUntil !== null);

    // Re-evaluating User A confirms User A remains unaffected by User B
    const userAEvalAfter = calculateNextInterval({
      currentInterval: userAEval.currentIntervalSeconds,
      consecutiveSuccesses: 6,
      rateLimitRemaining: 520,
      is429: false,
    });
    assert.equal(userAEvalAfter.currentIntervalSeconds, 60);
    assert.equal(userAEvalAfter.backoffSeconds, 0);
    assert.equal(userAEvalAfter.backoffUntil, null);
  });

  it('guarantees tenant boundaries on moderate vs high pressure', () => {
    // User A has 150 remaining tokens (moderate pressure)
    const userA = calculateNextInterval({
      currentInterval: 60,
      consecutiveSuccesses: 1,
      rateLimitRemaining: 150,
      is429: false,
    });
    assert.equal(userA.currentIntervalSeconds, 120);
    assert.equal(userA.rateLimitStatus, 'moderate');

    // User B has 50 remaining tokens (high pressure)
    const userB = calculateNextInterval({
      currentInterval: 60,
      consecutiveSuccesses: 1,
      rateLimitRemaining: 50,
      is429: false,
    });
    assert.equal(userB.currentIntervalSeconds, 180);
    assert.equal(userB.rateLimitStatus, 'high');
  });
});
