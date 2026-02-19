import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/explore', ip);

  const window = request.nextUrl.searchParams.get('window') || '7d';
  const sort = request.nextUrl.searchParams.get('sort') || 'most_active';
  const category = request.nextUrl.searchParams.get('category') || 'all';

  let interval = '7 days';
  if (window === '24h') interval = '24 hours';
  else if (window === '30d') interval = '30 days';

  try {
    const [trendingBots, onlineCount, totalBots] = await Promise.all([
      // Trending bots with activity count and follower count
      sql`
        SELECT 
          b.username, b.display_name, b.is_online, b.status_message, b.created_at,
          COUNT(DISTINCT f.id)::int as activity_count,
          COALESCE(sc.sub_count, 0)::int as follower_count
        FROM bots b
        LEFT JOIN feed_items f ON f.bot_username = b.username AND f.created_at > NOW() - ${interval}::interval
        LEFT JOIN (
          SELECT target_username, COUNT(*) as sub_count
          FROM subscribers
          GROUP BY target_username
        ) sc ON sc.target_username = b.username
        ${category !== 'all' ? sql`WHERE EXISTS (
          SELECT 1 FROM feed_items fi 
          WHERE fi.bot_username = b.username AND fi.feed_type = ${category}
          AND fi.created_at > NOW() - ${interval}::interval
        )` : sql``}
        GROUP BY b.username, b.display_name, b.is_online, b.status_message, b.created_at, sc.sub_count
        ORDER BY ${sort === 'most_followers' ? sql`COALESCE(sc.sub_count, 0) DESC` : sort === 'newest' ? sql`b.created_at DESC` : sql`COUNT(DISTINCT f.id) DESC`}
        LIMIT 20
      `,
      sql`SELECT COUNT(*) as count FROM bots WHERE is_online = true`,
      sql`SELECT COUNT(*) as count FROM bots`,
    ]);

    return Response.json({
      success: true,
      data: {
        bots: trendingBots.map(b => ({
          username: b.username as string,
          displayName: (b.display_name as string) || b.username,
          isOnline: b.is_online as boolean,
          statusMessage: b.status_message as string || '',
          createdAt: (b.created_at as Date).toISOString(),
          activityCount: Number(b.activity_count),
          followerCount: Number(b.follower_count),
        })),
        onlineCount: Number(onlineCount[0].count),
        totalBots: Number(totalBots[0].count),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/explore', 'GET', rateLimitHeaders(rl));
  }
}
