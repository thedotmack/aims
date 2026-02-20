import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, createAdminRequest } from '../helpers';

// Mock DB
vi.mock('@/lib/db', () => ({
  sql: vi.fn().mockResolvedValue([]),
  getBotByApiKey: vi.fn().mockResolvedValue(null),
  initDB: vi.fn().mockResolvedValue(undefined),
  getAllBotsCount: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/email', () => ({
  isEmailConfigured: vi.fn().mockReturnValue(false),
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/digest', () => ({
  sendDigestToSubscribers: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
}));

const ADMIN_KEY = 'test-admin-key-123';

describe('Admin Auth Protection', () => {
  beforeEach(() => {
    vi.stubEnv('AIMS_ADMIN_KEY', ADMIN_KEY);
  });

  describe('Admin API routes reject unauthenticated requests', () => {
    const adminRoutes = [
      { path: '/api/v1/admin/bots', method: 'GET' as const },
      { path: '/api/v1/admin/stats', method: 'GET' as const },
      { path: '/api/v1/admin/logs', method: 'GET' as const },
      { path: '/api/v1/admin/feed', method: 'GET' as const },
      { path: '/api/v1/admin/webhooks', method: 'GET' as const },
    ];

    for (const { path, method } of adminRoutes) {
      it(`${method} ${path} returns 403 without admin key`, async () => {
        const routePath = path.replace('/api/v1/', '@/app/api/v1/') + '/route';
        const mod = await import(routePath);
        const handler = mod[method];
        const req = createRequest(path);
        const res = await handler(req);
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toBe('Forbidden');
      });

      it(`${method} ${path} accepts valid admin key`, async () => {
        const routePath = path.replace('/api/v1/', '@/app/api/v1/') + '/route';
        const mod = await import(routePath);
        const handler = mod[method];
        const req = createAdminRequest(path);
        const res = await handler(req);
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(401);
      });
    }
  });

  describe('Admin key validation edge cases', () => {
    it('rejects wrong admin key', async () => {
      const { GET } = await import('@/app/api/v1/admin/stats/route');
      const req = createRequest('/api/v1/admin/stats', {
        headers: { Authorization: 'Bearer wrong-key' },
      });
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it('rejects missing Bearer prefix', async () => {
      const { GET } = await import('@/app/api/v1/admin/stats/route');
      const req = createRequest('/api/v1/admin/stats', {
        headers: { Authorization: ADMIN_KEY },
      });
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it('rejects empty Authorization header', async () => {
      const { GET } = await import('@/app/api/v1/admin/stats/route');
      const req = createRequest('/api/v1/admin/stats', {
        headers: { Authorization: '' },
      });
      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe('Admin-protected non-admin routes', () => {
    it('/api/v1/init requires admin key', async () => {
      const { POST } = await import('@/app/api/v1/init/route');
      const req = createRequest('/api/v1/init', { method: 'POST' });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('/api/v1/init/seed requires admin key', async () => {
      const { POST } = await import('@/app/api/v1/init/seed/route');
      const req = createRequest('/api/v1/init/seed', { method: 'POST' });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('/api/v1/digest/send requires admin key', async () => {
      const { POST } = await import('@/app/api/v1/digest/send/route');
      const req = createRequest('/api/v1/digest/send', { method: 'POST' });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  describe('log-internal endpoint auth', () => {
    it('accepts internal calls with X-Internal header', async () => {
      const { POST } = await import('@/app/api/v1/admin/log-internal/route');
      const req = createRequest('/api/v1/admin/log-internal', {
        method: 'POST',
        headers: { 'X-Internal': 'true' },
        body: { method: 'GET', endpoint: '/test', ip: '127.0.0.1', statusCode: 200 },
      });
      const res = await POST(req);
      expect(res.status).not.toBe(403);
    });

    it('rejects external calls without X-Internal or admin key', async () => {
      const { POST } = await import('@/app/api/v1/admin/log-internal/route');
      const req = createRequest('/api/v1/admin/log-internal', {
        method: 'POST',
        body: { method: 'GET', endpoint: '/test', ip: '127.0.0.1', statusCode: 200 },
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it('accepts admin key for external calls', async () => {
      const { POST } = await import('@/app/api/v1/admin/log-internal/route');
      const req = createAdminRequest('/api/v1/admin/log-internal', {
        method: 'POST',
        body: { method: 'GET', endpoint: '/test', ip: '127.0.0.1', statusCode: 200 },
      });
      const res = await POST(req);
      expect(res.status).not.toBe(403);
    });
  });

  describe('Digest cron auth', () => {
    it('rejects without auth', async () => {
      const { GET } = await import('@/app/api/v1/digest/cron/route');
      const req = createRequest('/api/v1/digest/cron');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('accepts admin key', async () => {
      const { GET } = await import('@/app/api/v1/digest/cron/route');
      const req = createAdminRequest('/api/v1/digest/cron');
      const res = await GET(req);
      expect(res.status).not.toBe(401);
    });
  });
});
