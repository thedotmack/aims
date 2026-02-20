import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const ADMIN_KEY = 'test-admin-key-456';

describe('Middleware Admin/Dashboard Auth', () => {
  beforeEach(() => {
    vi.stubEnv('AIMS_ADMIN_KEY', ADMIN_KEY);
    vi.resetModules();
  });

  async function runMiddleware(url: string, opts?: { cookies?: Record<string, string>; }) {
    const { middleware } = await import('@/middleware');
    const req = new NextRequest(new URL(url, 'http://localhost:3000'));
    if (opts?.cookies) {
      for (const [k, v] of Object.entries(opts.cookies)) {
        req.cookies.set(k, v);
      }
    }
    return middleware(req);
  }

  describe('/admin page protection', () => {
    it('returns 403 without admin key', async () => {
      const res = await runMiddleware('/admin');
      expect(res.status).toBe(403);
    });

    it('allows access with correct ?key= param', async () => {
      const res = await runMiddleware(`/admin?key=${ADMIN_KEY}`);
      expect(res.status).toBe(200);
      // Should set cookie for session persistence
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('aims_admin_key');
    });

    it('allows access with valid cookie', async () => {
      const res = await runMiddleware('/admin', { cookies: { aims_admin_key: ADMIN_KEY } });
      expect(res.status).toBe(200);
    });

    it('rejects wrong key param', async () => {
      const res = await runMiddleware('/admin?key=wrong-key');
      expect(res.status).toBe(403);
    });

    it('rejects wrong cookie', async () => {
      const res = await runMiddleware('/admin', { cookies: { aims_admin_key: 'wrong' } });
      expect(res.status).toBe(403);
    });

    it('returns 503 when AIMS_ADMIN_KEY not configured', async () => {
      vi.stubEnv('AIMS_ADMIN_KEY', '');
      vi.resetModules();
      const { middleware } = await import('@/middleware');
      const req = new NextRequest(new URL('/admin', 'http://localhost:3000'));
      const res = middleware(req);
      expect(res.status).toBe(503);
    });

    it('protects /admin sub-paths', async () => {
      const res = await runMiddleware('/admin/settings');
      expect(res.status).toBe(403);
    });
  });

  describe('/dashboard page protection', () => {
    it('returns 403 without API key', async () => {
      const res = await runMiddleware('/dashboard');
      expect(res.status).toBe(403);
    });

    it('allows access with valid ?apiKey= param', async () => {
      const res = await runMiddleware('/dashboard?apiKey=aims_test123');
      expect(res.status).toBe(200);
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toContain('aims_bot_key');
    });

    it('allows access with valid cookie', async () => {
      const res = await runMiddleware('/dashboard', { cookies: { aims_bot_key: 'aims_test123' } });
      expect(res.status).toBe(200);
    });

    it('rejects non-aims_ prefixed key', async () => {
      const res = await runMiddleware('/dashboard?apiKey=invalid_key');
      expect(res.status).toBe(403);
    });

    it('rejects empty key', async () => {
      const res = await runMiddleware('/dashboard?apiKey=');
      expect(res.status).toBe(403);
    });

    it('protects /dashboard sub-paths', async () => {
      const res = await runMiddleware('/dashboard/settings');
      expect(res.status).toBe(403);
    });
  });
});
