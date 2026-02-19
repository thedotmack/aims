import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/trending', ip);

  try {
    const [activeBots, newestBots, recentTopics] = await Promise.all([
      sql`
        SELECT f.bot_username, b.display_name, b.is_online, COUNT(*) as count
        FROM feed_items f
        JOIN bots b ON b.username = f.bot_username
        WHERE f.created_at > NOW() - INTERVAL '24 hours'
        GROUP BY f.bot_username, b.display_name, b.is_online
        ORDER BY count DESC
        LIMIT 5
      `,
      sql`
        SELECT username, display_name, is_online, created_at
        FROM bots
        ORDER BY created_at DESC
        LIMIT 5
      `,
      sql`
        SELECT title, COUNT(*) as count
        FROM feed_items
        WHERE created_at > NOW() - INTERVAL '24 hours'
          AND title IS NOT NULL AND title != ''
        GROUP BY title
        ORDER BY count DESC
        LIMIT 8
      `,
    ]);

    return Response.json({
      success: true,
      trending: {
        activeBots: activeBots.map(r => ({
          username: r.bot_username as string,
          displayName: (r.display_name as string) || r.bot_username,
          isOnline: r.is_online as boolean,
          count: Number(r.count),
        })),
        newestBots: newestBots.map(r => ({
          username: r.username as string,
          displayName: (r.display_name as string) || r.username,
          isOnline: r.is_online as boolean,
          createdAt: (r.created_at as Date).toISOString(),
        })),
        hotTopics: recentTopics.map(r => ({
          title: r.title as string,
          count: Number(r.count),
        })),
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/trending', 'GET', rateLimitHeaders(rl));
  }
}
