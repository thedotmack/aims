import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  checkRateLimitAsync,
  rateLimitHeaders,
  rateLimitResponse,
  isRedisConfigured,
  LIMITS,
  getClientIp,
  _resetMemoryStores,
  _resetRedisLimiters,
} from '../../lib/ratelimit';

describe('ratelimit', () => {
  beforeEach(() => {
    _resetMemoryStores();
    _resetRedisLimiters();
  });

  // -----------------------------------------------------------------------
  // In-memory (sync) — checkRateLimit
  // -----------------------------------------------------------------------
  describe('checkRateLimit (in-memory, sync)', () => {
    const cfg = { name: 'test-sync', max: 3, windowMs: 60_000 };

    it('allows requests under the limit', () => {
      const r = checkRateLimit(cfg, '1.2.3.4');
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(2);
      expect(r.limit).toBe(3);
    });

    it('tracks remaining correctly', () => {
      checkRateLimit(cfg, 'a');
      checkRateLimit(cfg, 'a');
      const r = checkRateLimit(cfg, 'a');
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(0);
    });

    it('blocks after exceeding limit', () => {
      for (let i = 0; i < 3; i++) checkRateLimit(cfg, 'b');
      const r = checkRateLimit(cfg, 'b');
      expect(r.allowed).toBe(false);
      expect(r.remaining).toBe(0);
    });

    it('isolates different identifiers', () => {
      for (let i = 0; i < 3; i++) checkRateLimit(cfg, 'x');
      const blocked = checkRateLimit(cfg, 'x');
      const fresh = checkRateLimit(cfg, 'y');
      expect(blocked.allowed).toBe(false);
      expect(fresh.allowed).toBe(true);
    });

    it('isolates different limiter names', () => {
      const cfg2 = { name: 'test-other', max: 1, windowMs: 60_000 };
      checkRateLimit(cfg2, 'z'); // uses all 1 slot
      const blocked = checkRateLimit(cfg2, 'z');
      const ok = checkRateLimit(cfg, 'z'); // different name, separate budget
      expect(blocked.allowed).toBe(false);
      expect(ok.allowed).toBe(true);
    });

    it('resets after window expires', () => {
      vi.useFakeTimers();
      try {
        for (let i = 0; i < 3; i++) checkRateLimit(cfg, 'c');
        const blocked = checkRateLimit(cfg, 'c');
        expect(blocked.allowed).toBe(false);

        vi.advanceTimersByTime(60_001);
        const fresh = checkRateLimit(cfg, 'c');
        expect(fresh.allowed).toBe(true);
        expect(fresh.remaining).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Async — checkRateLimitAsync (falls back to in-memory when no Redis)
  // -----------------------------------------------------------------------
  describe('checkRateLimitAsync (fallback to in-memory)', () => {
    const cfg = { name: 'test-async', max: 2, windowMs: 60_000 };

    it('returns allowed when under limit', async () => {
      const r = await checkRateLimitAsync(cfg, 'ip1');
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(1);
    });

    it('blocks after exceeding limit', async () => {
      await checkRateLimitAsync(cfg, 'ip2');
      await checkRateLimitAsync(cfg, 'ip2');
      const r = await checkRateLimitAsync(cfg, 'ip2');
      expect(r.allowed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // isRedisConfigured
  // -----------------------------------------------------------------------
  describe('isRedisConfigured', () => {
    it('returns false when env vars are absent', () => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      expect(isRedisConfigured()).toBe(false);
    });

    it('returns false when only URL is set', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      expect(isRedisConfigured()).toBe(false);
      delete process.env.UPSTASH_REDIS_REST_URL;
    });

    it('returns true when both are set', () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token123';
      expect(isRedisConfigured()).toBe(true);
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });
  });

  // -----------------------------------------------------------------------
  // rateLimitHeaders
  // -----------------------------------------------------------------------
  describe('rateLimitHeaders', () => {
    it('returns correct headers', () => {
      const h = rateLimitHeaders({ allowed: true, limit: 100, remaining: 99, resetAt: 1700000000000 });
      expect(h['X-RateLimit-Limit']).toBe('100');
      expect(h['X-RateLimit-Remaining']).toBe('99');
      expect(h['X-RateLimit-Reset']).toBe('1700000000');
    });
  });

  // -----------------------------------------------------------------------
  // rateLimitResponse
  // -----------------------------------------------------------------------
  describe('rateLimitResponse', () => {
    it('returns 429 with Retry-After header', async () => {
      const result = { allowed: false, limit: 5, remaining: 0, resetAt: Date.now() + 120_000 };
      const resp = rateLimitResponse(result, '/api/test', '1.2.3.4');
      expect(resp.status).toBe(429);
      expect(resp.headers.get('Retry-After')).toBeTruthy();
      const body = await resp.json();
      expect(body.success).toBe(false);
      expect(body.retryAfter).toBeGreaterThan(0);
      expect(body.error).toContain('rate limit');
    });

    it('shows friendly wait time in minutes when >1 min', async () => {
      const result = { allowed: false, limit: 5, remaining: 0, resetAt: Date.now() + 300_000 };
      const resp = rateLimitResponse(result, '/api/test', '1.2.3.4');
      const body = await resp.json();
      expect(body.error).toContain('minutes');
    });
  });

  // -----------------------------------------------------------------------
  // LIMITS constants
  // -----------------------------------------------------------------------
  describe('LIMITS', () => {
    it('has all expected limiters', () => {
      expect(LIMITS.PUBLIC_READ.max).toBe(100);
      expect(LIMITS.AUTH_WRITE.max).toBe(30);
      expect(LIMITS.REGISTER.max).toBe(5);
      expect(LIMITS.REGISTER.windowMs).toBe(3600_000);
      expect(LIMITS.SEARCH.max).toBe(30);
      expect(LIMITS.WEBHOOK_INGEST.max).toBe(60);
    });
  });

  // -----------------------------------------------------------------------
  // getClientIp
  // -----------------------------------------------------------------------
  describe('getClientIp', () => {
    it('prefers cf-connecting-ip', () => {
      const req = new Request('http://x', { headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' } });
      expect(getClientIp(req)).toBe('1.1.1.1');
    });

    it('falls back to x-forwarded-for first entry', () => {
      const req = new Request('http://x', { headers: { 'x-forwarded-for': '3.3.3.3, 4.4.4.4' } });
      expect(getClientIp(req)).toBe('3.3.3.3');
    });

    it('returns unknown when no headers', () => {
      const req = new Request('http://x');
      expect(getClientIp(req)).toBe('unknown');
    });
  });
});
