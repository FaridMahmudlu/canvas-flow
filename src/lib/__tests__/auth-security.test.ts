import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeCallbackUrl } from '@/lib/auth-helpers';
import { SlidingWindowRateLimiter, getClientIp } from '@/lib/rate-limit';

describe('Auth Security: Open Redirect Prevention (getSafeCallbackUrl)', () => {
  it('allows safe internal paths', () => {
    assert.equal(getSafeCallbackUrl('/'), '/');
    assert.equal(getSafeCallbackUrl('/settings'), '/settings');
    assert.equal(getSafeCallbackUrl('/courses'), '/courses');
    assert.equal(getSafeCallbackUrl('/connect'), '/connect');
    assert.equal(getSafeCallbackUrl('/tasks?filter=due_soon'), '/tasks?filter=due_soon');
  });

  it('rejects external URLs and redirects safely to root', () => {
    assert.equal(getSafeCallbackUrl('https://evil.com'), '/');
    assert.equal(getSafeCallbackUrl('http://attacker.com/login'), '/');
    assert.equal(getSafeCallbackUrl('https://sub.evil.com/phish'), '/');
  });

  it('rejects protocol-relative URLs (e.g. //evil.com)', () => {
    assert.equal(getSafeCallbackUrl('//evil.com'), '/');
    assert.equal(getSafeCallbackUrl('//evil.com/path'), '/');
    assert.equal(getSafeCallbackUrl('///evil.com'), '/');
  });

  it('rejects backslash and mixed URI exploits', () => {
    assert.equal(getSafeCallbackUrl('/\\evil.com'), '/');
    assert.equal(getSafeCallbackUrl('\\evil.com'), '/');
    assert.equal(getSafeCallbackUrl('/path\\with\\backslash'), '/');
  });

  it('rejects javascript:, data:, and other schemes', () => {
    assert.equal(getSafeCallbackUrl('javascript:alert(1)'), '/');
    assert.equal(getSafeCallbackUrl('data:text/html,<script>alert(1)</script>'), '/');
    assert.equal(getSafeCallbackUrl('vbscript:msgbox'), '/');
  });

  it('safely handles empty, null, undefined, and whitespace inputs', () => {
    assert.equal(getSafeCallbackUrl(''), '/');
    assert.equal(getSafeCallbackUrl(null), '/');
    assert.equal(getSafeCallbackUrl(undefined), '/');
    assert.equal(getSafeCallbackUrl('   '), '/');
    assert.equal(getSafeCallbackUrl('  /settings  '), '/settings');
  });
});

describe('Auth Security: Sliding Window Rate Limiter', () => {
  it('permits requests within allowed threshold', () => {
    const limiter = new SlidingWindowRateLimiter(3, 10000);
    const id = `user_test_${Date.now()}`;

    const r1 = limiter.check(id);
    assert.equal(r1.success, true);
    assert.equal(r1.remaining, 2);

    const r2 = limiter.check(id);
    assert.equal(r2.success, true);
    assert.equal(r2.remaining, 1);

    const r3 = limiter.check(id);
    assert.equal(r3.success, true);
    assert.equal(r3.remaining, 0);
  });

  it('blocks requests exceeding the threshold', () => {
    const limiter = new SlidingWindowRateLimiter(2, 10000);
    const id = `blocked_user_${Date.now()}`;

    limiter.check(id);
    limiter.check(id);

    const blocked = limiter.check(id);
    assert.equal(blocked.success, false);
    assert.equal(blocked.remaining, 0);
  });

  it('allows resetting rate limit state upon successful authentication', () => {
    const limiter = new SlidingWindowRateLimiter(2, 10000);
    const id = `reset_user_${Date.now()}`;

    limiter.check(id);
    limiter.check(id);
    assert.equal(limiter.check(id).success, false);

    limiter.reset(id);
    const afterReset = limiter.check(id);
    assert.equal(afterReset.success, true);
    assert.equal(afterReset.remaining, 1);
  });

  it('extracts client IP safely from forwarded headers', () => {
    const mockReq1 = {
      headers: new Headers({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18' }),
    } as unknown as Request;
    assert.equal(getClientIp(mockReq1), '203.0.113.195');

    const mockReq2 = {
      headers: new Headers({ 'cf-connecting-ip': '198.51.100.42' }),
    } as unknown as Request;
    assert.equal(getClientIp(mockReq2), '198.51.100.42');

    const mockReq3 = {
      headers: new Headers({ 'x-real-ip': '192.0.2.1' }),
    } as unknown as Request;
    assert.equal(getClientIp(mockReq3), '192.0.2.1');

    const mockReqEmpty = {
      headers: new Headers(),
    } as unknown as Request;
    assert.equal(getClientIp(mockReqEmpty), '127.0.0.1');
  });
});
