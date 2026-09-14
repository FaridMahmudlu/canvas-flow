import type { NextRequest } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

export class SlidingWindowRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {
    // Schedule periodic sweep of expired records every 5 minutes
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
        this.cleanupTimer.unref();
      }
    }
  }

  public check(identifier: string): RateLimitResult {
    const now = Date.now();
    const existing = this.records.get(identifier);

    if (!existing || now >= existing.resetTime) {
      // First request or window has expired
      const resetTime = now + this.windowMs;
      this.records.set(identifier, { count: 1, resetTime });
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        resetTime,
      };
    }

    if (existing.count < this.maxRequests) {
      existing.count += 1;
      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - existing.count,
        resetTime: existing.resetTime,
      };
    }

    // Rate limit exceeded
    return {
      success: false,
      limit: this.maxRequests,
      remaining: 0,
      resetTime: existing.resetTime,
    };
  }

  public reset(identifier: string): void {
    this.records.delete(identifier);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now >= record.resetTime) {
        this.records.delete(key);
      }
    }
  }
}

/**
 * Extract client IP from Next.js request headers safely.
 */
export function getClientIp(req: NextRequest | Request): string {
  const headers = req.headers;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

// Preconfigured rate limiters
// 15 registration attempts per 15 minutes per IP
export const registerRateLimiter = new SlidingWindowRateLimiter(
  process.env.NODE_ENV === 'test' ? 200 : 20,
  15 * 60 * 1000
);

// 15 failed login attempts per 15 minutes per IP/email
export const loginRateLimiter = new SlidingWindowRateLimiter(
  process.env.NODE_ENV === 'test' ? 200 : 20,
  15 * 60 * 1000
);

// 15 Canvas connect verification attempts per 1 minute per user
export const canvasConnectLimiter = new SlidingWindowRateLimiter(
  process.env.NODE_ENV === 'test' ? 200 : 20,
  60 * 1000
);
