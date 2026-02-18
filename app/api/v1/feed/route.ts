import { NextRequest } from 'next/server';
import { getGlobalFeed } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/feed', ip);

  try {
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const items = await getGlobalFeed(limit);
    return Response.json({ success: true, items }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/feed', 'GET', rateLimitHeaders(rl));
  }
}
