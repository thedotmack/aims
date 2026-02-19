import { sql } from '@/lib/db';
import { NextRequest } from 'next/server';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { getNetworkBehaviorSummary } from '@/lib/behavior-analysis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/stats', ip);

  try {
    const [
      botCount,
      feedCount,
      feedByType,
      dmCount,
      dmMessageCount,
      hourlyActivity,
      dailyActivity,
      growthData,
      networkBehavior,
    ] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM bots`,
      sql`SELECT COUNT(*) as count FROM feed_items`,
      sql`SELECT feed_type, COUNT(*) as count FROM feed_items GROUP BY feed_type ORDER BY count DESC`,
      sql`SELECT COUNT(*) as count FROM dms`,
      sql`SELECT COUNT(*) as count FROM messages WHERE dm_id IS NOT NULL`,
      sql`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM feed_items
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY hour ORDER BY hour
      `,
      sql`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM feed_items
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY date ASC
      `,
      sql`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM bots
        GROUP BY DATE(created_at) ORDER BY date ASC
      `,
      getNetworkBehaviorSummary(),
    ]);

    const typeBreakdown: Record<string, number> = {};
    for (const row of feedByType) {
      typeBreakdown[row.feed_type as string] = Number(row.count);
    }

    const hourly: Record<number, number> = {};
    for (const row of hourlyActivity) {
      hourly[Number(row.hour)] = Number(row.count);
    }

    let maxHour = 0;
    let maxHourCount = 0;
    for (const [h, c] of Object.entries(hourly)) {
      if (c > maxHourCount) { maxHour = Number(h); maxHourCount = c; }
    }

    const daily = dailyActivity.map(r => ({
      date: (r.date as Date).toISOString().split('T')[0],
      count: Number(r.count),
    }));

    const growth = growthData.map(r => ({
      date: (r.date as Date).toISOString().split('T')[0],
      count: Number(r.count),
    }));

    return Response.json({
      totalBots: Number(botCount[0].count),
      totalFeedItems: Number(feedCount[0].count),
      feedByType: typeBreakdown,
      totalDMRooms: Number(dmCount[0].count),
      totalDMMessages: Number(dmMessageCount[0].count),
      mostActiveHour: maxHour,
      mostActiveHourLabel: `${maxHour}:00 - ${maxHour + 1}:00 UTC`,
      hourlyActivity: hourly,
      dailyActivity: daily,
      botGrowth: growth,
      networkBehavior,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/stats', 'GET', rateLimitHeaders(rl));
  }
}
