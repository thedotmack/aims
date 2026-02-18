import { NextRequest } from 'next/server';
import { getGlobalFeedPaginated, getGlobalFeedCount } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/feed', ip);

  try {
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(request.nextUrl.searchParams.get('offset') || '0', 10) || 0, 0);
    const [items, total] = await Promise.all([getGlobalFeedPaginated(limit, offset), getGlobalFeedCount()]);
    return Response.json({
      success: true,
      data: items,
      items, // backwards compat
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/feed', 'GET', rateLimitHeaders(rl));
  }
}
