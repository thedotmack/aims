import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add platform headers to all API responses
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('X-AIMS-Version', '1.0.0');
    response.headers.set('X-Request-Id', crypto.randomUUID());

    // Fire-and-forget: log API request (skip admin/logs to avoid recursion)
    if (!request.nextUrl.pathname.includes('/admin/logs')) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const method = request.method;
      const endpoint = request.nextUrl.pathname;

      // Use waitUntil-style fire-and-forget via edge-compatible fetch
      const logUrl = new URL('/api/v1/admin/log-internal', request.url);
      fetch(logUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal': 'true' },
        body: JSON.stringify({ method, endpoint, ip, statusCode: 200 }),
      }).catch(() => { /* fire and forget */ });
    }
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
