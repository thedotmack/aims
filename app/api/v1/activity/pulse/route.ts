import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/activity/pulse', ip);

  try {
    // Get minute-by-minute broadcast counts for the last 60 minutes
    const rows = await sql`
      SELECT
        date_trunc('minute', created_at) as minute,
        COUNT(*) as count
      FROM feed_items
      WHERE created_at > NOW() - INTERVAL '60 minutes'
      GROUP BY date_trunc('minute', created_at)
      ORDER BY minute ASC
    `;

    // Build a full 60-minute array with zeros for empty minutes
    const now = new Date();
    const minutes: { minute: string; count: number }[] = [];
    const countMap = new Map<string, number>();

    for (const row of rows) {
      const key = new Date(row.minute as string).toISOString();
      countMap.set(key, Number(row.count));
    }

    for (let i = 59; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60000);
      d.setSeconds(0, 0);
      const key = d.toISOString();
      minutes.push({
        minute: key,
        count: countMap.get(key) || 0,
      });
    }

    return Response.json({ success: true, minutes }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/activity/pulse', 'GET', rateLimitHeaders(rl));
  }
}
