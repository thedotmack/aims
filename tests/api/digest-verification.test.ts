import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
const mockSubscribeToDigest = vi.fn();
const mockVerifyDigestSubscriber = vi.fn();
const mockGetDigestSubscribers = vi.fn();

vi.mock('@/lib/db', () => ({
  subscribeToDigest: (...args: unknown[]) => mockSubscribeToDigest(...args),
  verifyDigestSubscriber: (...args: unknown[]) => mockVerifyDigestSubscriber(...args),
  getDigestSubscribers: (...args: unknown[]) => mockGetDigestSubscribers(...args),
  getDailyDigestStats: vi.fn().mockResolvedValue({ totalBroadcasts: 0, mostActiveBots: [], typeBreakdown: {}, topThoughts: [], newBots: [] }),
  getRecentDigestRun: vi.fn().mockResolvedValue(null),
  createDigestRun: vi.fn().mockResolvedValue('run-1'),
  completeDigestRun: vi.fn(),
  failDigestRun: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 }),
  rateLimitResponse: vi.fn(),
  LIMITS: { AUTH_WRITE: { name: 'auth_write', windowMs: 60000, maxRequests: 30 }, PUBLIC_READ: { name: 'public_read', windowMs: 60000, maxRequests: 100 } },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, id: 'test-id', mode: 'live' }),
  isEmailConfigured: vi.fn().mockReturnValue(true),
}));

import { isEmailConfigured } from '@/lib/email';

describe('Digest Verification Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/digest/subscribe', () => {
    it('returns needsVerification=true when email is configured', async () => {
      mockSubscribeToDigest.mockResolvedValue({ success: true, verificationToken: 'vtoken-123', unsubscribeToken: 'utoken-456' });
      const { POST } = await import('@/app/api/v1/digest/subscribe/route');
      const req = new Request('http://localhost/api/v1/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', frequency: 'daily' }),
      });
      const res = await POST(req as any);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.needsVerification).toBe(true);
    });

    it('skips verification for already-verified subscriber', async () => {
      mockSubscribeToDigest.mockResolvedValue({ success: true, existing: true, alreadyVerified: true, unsubscribeToken: 'utoken' });
      const { POST } = await import('@/app/api/v1/digest/subscribe/route');
      const req = new Request('http://localhost/api/v1/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'verified@example.com', frequency: 'weekly' }),
      });
      const res = await POST(req as any);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.verified).toBe(true);
      expect(data.needsVerification).toBeUndefined();
    });

    it('does not require verification when email is not configured', async () => {
      vi.mocked(isEmailConfigured).mockReturnValue(false);
      mockSubscribeToDigest.mockResolvedValue({ success: true, verificationToken: 'vtoken', unsubscribeToken: 'utoken' });
      const { POST } = await import('@/app/api/v1/digest/subscribe/route');
      const req = new Request('http://localhost/api/v1/digest/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dev@local.test', frequency: 'daily' }),
      });
      const res = await POST(req as any);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.needsVerification).toBeUndefined();
    });
  });

  describe('GET /api/v1/digest/verify', () => {
    it('verifies a valid token', async () => {
      mockVerifyDigestSubscriber.mockResolvedValue({ success: true, email: 'test@example.com' });
      const { GET } = await import('@/app/api/v1/digest/verify/route');
      const req = new Request('http://localhost/api/v1/digest/verify?token=valid-token');
      const res = await GET(req as any);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.email).toBe('test@example.com');
      expect(data.alreadyVerified).toBe(false);
    });

    it('returns 404 for invalid token', async () => {
      mockVerifyDigestSubscriber.mockResolvedValue({ success: false });
      const { GET } = await import('@/app/api/v1/digest/verify/route');
      const req = new Request('http://localhost/api/v1/digest/verify?token=bad-token');
      const res = await GET(req as any);
      expect(res.status).toBe(404);
    });

    it('returns 400 when token is missing', async () => {
      const { GET } = await import('@/app/api/v1/digest/verify/route');
      const req = new Request('http://localhost/api/v1/digest/verify');
      const res = await GET(req as any);
      expect(res.status).toBe(400);
    });

    it('indicates already-verified tokens', async () => {
      mockVerifyDigestSubscriber.mockResolvedValue({ success: true, email: 'test@example.com', alreadyVerified: true });
      const { GET } = await import('@/app/api/v1/digest/verify/route');
      const req = new Request('http://localhost/api/v1/digest/verify?token=used-token');
      const res = await GET(req as any);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.alreadyVerified).toBe(true);
    });
  });

  describe('Digest sending filters by verified', () => {
    it('passes verifiedOnly=true when email is configured', async () => {
      vi.mocked(isEmailConfigured).mockReturnValue(true);
      mockGetDigestSubscribers.mockResolvedValue([]);
      const { sendDigestToSubscribers } = await import('@/lib/digest');
      await sendDigestToSubscribers('daily', { skipIdempotencyCheck: true });
      expect(mockGetDigestSubscribers).toHaveBeenCalledWith('daily', { verifiedOnly: true });
    });

    it('passes verifiedOnly=false when email is not configured', async () => {
      vi.mocked(isEmailConfigured).mockReturnValue(false);
      const { sendDigestToSubscribers } = await import('@/lib/digest');
      const result = await sendDigestToSubscribers('daily');
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('email_not_configured');
    });
  });
});
