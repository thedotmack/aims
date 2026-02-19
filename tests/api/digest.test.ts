import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
vi.mock('@/lib/db', () => ({
  subscribeToDigest: vi.fn(),
  unsubscribeFromDigest: vi.fn(),
  getDigestSubscribers: vi.fn(),
  getDailyDigestStats: vi.fn(),
}));

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimitAsync: vi.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60000, limit: 30 }),
  rateLimitResponse: vi.fn(),
  LIMITS: { AUTH_WRITE: { name: 'auth_write', maxRequests: 30, windowMs: 60000 } },
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import { subscribeToDigest, unsubscribeFromDigest } from '@/lib/db';

describe('POST /api/v1/digest/subscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('subscribes with valid email and frequency', async () => {
    (subscribeToDigest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, unsubscribeToken: 'tok-123' });

    const { POST } = await import('@/app/api/v1/digest/subscribe/route');
    const req = new Request('http://localhost/api/v1/digest/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', frequency: 'daily' }),
    });
    const res = await POST(req as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('rejects missing email', async () => {
    const { POST } = await import('@/app/api/v1/digest/subscribe/route');
    const req = new Request('http://localhost/api/v1/digest/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frequency: 'daily' }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('rejects invalid email', async () => {
    const { POST } = await import('@/app/api/v1/digest/subscribe/route');
    const req = new Request('http://localhost/api/v1/digest/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', frequency: 'daily' }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('rejects invalid frequency', async () => {
    const { POST } = await import('@/app/api/v1/digest/subscribe/route');
    const req = new Request('http://localhost/api/v1/digest/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', frequency: 'monthly' }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('handles existing subscriber update', async () => {
    (subscribeToDigest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, existing: true, unsubscribeToken: 'tok-456' });

    const { POST } = await import('@/app/api/v1/digest/subscribe/route');
    const req = new Request('http://localhost/api/v1/digest/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', frequency: 'weekly' }),
    });
    const res = await POST(req as never);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.existing).toBe(true);
  });
});

describe('POST /api/v1/digest/unsubscribe', () => {
  beforeEach(() => vi.clearAllMocks());

  it('unsubscribes with valid token', async () => {
    (unsubscribeFromDigest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, email: 'test@example.com' });

    const { POST } = await import('@/app/api/v1/digest/unsubscribe/route');
    const req = new Request('http://localhost/api/v1/digest/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'valid-token' }),
    });
    const res = await POST(req as never);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 404 for invalid token', async () => {
    (unsubscribeFromDigest as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });

    const { POST } = await import('@/app/api/v1/digest/unsubscribe/route');
    const req = new Request('http://localhost/api/v1/digest/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'bad-token' }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(404);
  });

  it('rejects missing token', async () => {
    const { POST } = await import('@/app/api/v1/digest/unsubscribe/route');
    const req = new Request('http://localhost/api/v1/digest/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});
