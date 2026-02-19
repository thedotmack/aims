import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function makeRequest(path: string, opts: { searchParams?: Record<string, string>; cookies?: Record<string, string> } = {}) {
  const url = new URL(path, 'http://localhost:3000');
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  const req = new NextRequest(url);
  if (opts.cookies) {
    for (const [k, v] of Object.entries(opts.cookies)) {
      req.cookies.set(k, v);
    }
  }
  return req;
}

describe('Middleware — Admin Auth', () => {
  it('blocks /admin without key', () => {
    const res = middleware(makeRequest('/admin'));
    expect(res.status).toBe(403);
  });

  it('blocks /admin with wrong key', () => {
    const res = middleware(makeRequest('/admin', { searchParams: { key: 'wrong' } }));
    expect(res.status).toBe(403);
  });

  it('allows /admin with correct key param', () => {
    const res = middleware(makeRequest('/admin', { searchParams: { key: 'test-admin-key-123' } }));
    // Should set cookie and pass through (200 from NextResponse.next())
    expect(res.status).toBe(200);
    expect(res.cookies.get('aims_admin_key')?.value).toBe('test-admin-key-123');
  });

  it('allows /admin with correct cookie', () => {
    const res = middleware(makeRequest('/admin', { cookies: { aims_admin_key: 'test-admin-key-123' } }));
    expect(res.status).toBe(200);
  });

  it('blocks /admin/some-page without key', () => {
    const res = middleware(makeRequest('/admin/dashboard'));
    expect(res.status).toBe(403);
  });
});

describe('Middleware — Dashboard Auth', () => {
  it('blocks /dashboard without API key', () => {
    const res = middleware(makeRequest('/dashboard'));
    expect(res.status).toBe(403);
  });

  it('blocks /dashboard with non-aims key', () => {
    const res = middleware(makeRequest('/dashboard', { searchParams: { apiKey: 'invalid_key' } }));
    expect(res.status).toBe(403);
  });

  it('allows /dashboard with valid aims_ key param', () => {
    const res = middleware(makeRequest('/dashboard', { searchParams: { apiKey: 'aims_testkey123' } }));
    expect(res.status).toBe(200);
    expect(res.cookies.get('aims_bot_key')?.value).toBe('aims_testkey123');
  });

  it('allows /dashboard with valid cookie', () => {
    const res = middleware(makeRequest('/dashboard', { cookies: { aims_bot_key: 'aims_testkey123' } }));
    expect(res.status).toBe(200);
  });
});

describe('Middleware — Public Routes', () => {
  it('allows /api/* without blocking (adds headers)', () => {
    const res = middleware(makeRequest('/api/v1/feed'));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-AIMS-Version')).toBe('1.0.0');
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });

  it('passes through non-matched routes', () => {
    const res = middleware(makeRequest('/feed'));
    expect(res.status).toBe(200);
  });

  it('passes through bot profile routes', () => {
    const res = middleware(makeRequest('/bots/some-bot'));
    expect(res.status).toBe(200);
  });

  it('passes through search route', () => {
    const res = middleware(makeRequest('/search'));
    expect(res.status).toBe(200);
  });
});
