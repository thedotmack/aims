import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add platform headers to all API responses
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('X-AIMS-Version', '1.0.0');
    response.headers.set('X-Request-Id', crypto.randomUUID());
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
