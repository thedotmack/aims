import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Admin page protection ──────────────────────────────────────
  // Requires AIMS_ADMIN_KEY via ?key= query param or cookie
  if (pathname.startsWith('/admin')) {
    const adminKey = process.env.AIMS_ADMIN_KEY;
    if (!adminKey) {
      return new NextResponse('Admin not configured', { status: 503 });
    }
    const keyParam = request.nextUrl.searchParams.get('key');
    const keyCookie = request.cookies.get('aims_admin_key')?.value;
    if (keyParam === adminKey) {
      // Set cookie so they don't need the query param on every page
      const response = NextResponse.next();
      response.cookies.set('aims_admin_key', adminKey, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24h
      });
      return response;
    }
    if (keyCookie !== adminKey) {
      return new NextResponse('Forbidden — admin key required (?key=YOUR_ADMIN_KEY)', { status: 403 });
    }
  }

  // ─── Dashboard page protection ─────────────────────────────────
  // Requires a valid bot API key via ?apiKey= query param or cookie
  if (pathname.startsWith('/dashboard')) {
    const apiKeyParam = request.nextUrl.searchParams.get('apiKey');
    const apiKeyCookie = request.cookies.get('aims_bot_key')?.value;
    const key = apiKeyParam || apiKeyCookie;
    if (!key || !key.startsWith('aims_')) {
      return new NextResponse('Forbidden — bot API key required (?apiKey=YOUR_API_KEY)', { status: 403 });
    }
    if (apiKeyParam) {
      // Set cookie for subsequent page loads
      const response = NextResponse.next();
      response.cookies.set('aims_bot_key', apiKeyParam, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24h
      });
      return response;
    }
  }

  // ─── API response headers ──────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    response.headers.set('X-AIMS-Version', '1.0.0');
    response.headers.set('X-Request-Id', crypto.randomUUID());

    // Fire-and-forget: log API request (skip admin/logs to avoid recursion)
    if (!pathname.includes('/admin/logs')) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const method = request.method;

      const logUrl = new URL('/api/v1/admin/log-internal', request.url);
      fetch(logUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal': 'true' },
        body: JSON.stringify({ method, endpoint: pathname, ip, statusCode: 200 }),
      }).catch(() => { /* fire and forget */ });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/admin', '/dashboard/:path*', '/dashboard'],
};
