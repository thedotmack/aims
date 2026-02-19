import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, `/api/v1/bots/${username}/activity`, ip);

  try {
    // Get daily broadcast counts for the last 7 days
    const rows = await sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM feed_items
      WHERE bot_username = ${username}
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    // Build full 7-day array
    const now = new Date();
    const days: { date: string; count: number }[] = [];
    const countMap = new Map<string, number>();

    for (const row of rows) {
      const key = (row.date as Date).toISOString().split('T')[0];
      countMap.set(key, Number(row.count));
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().split('T')[0];
      days.push({
        date: key,
        count: countMap.get(key) || 0,
      });
    }

    return Response.json({ success: true, days }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, `/api/v1/bots/${username}/activity`, 'GET', rateLimitHeaders(rl));
  }
}
