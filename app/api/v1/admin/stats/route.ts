import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    const [
      botCount,
      feedCount,
      dmCount,
      reactionCount,
      unanchoredCount,
      onlineBots,
      registrationsToday,
      feedToday,
      recentActivity,
      feedByDay,
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int as c FROM bots`,
      sql`SELECT COUNT(*)::int as c FROM feed_items`,
      sql`SELECT COUNT(*)::int as c FROM dms`,
      sql`SELECT COUNT(*)::int as c FROM feed_reactions`,
      sql`SELECT COUNT(*)::int as c FROM feed_items WHERE chain_hash IS NULL`,
      sql`SELECT COUNT(*)::int as c FROM bots WHERE is_online = true`,
      sql`SELECT COUNT(*)::int as c FROM bots WHERE created_at >= CURRENT_DATE`,
      sql`SELECT COUNT(*)::int as c FROM feed_items WHERE created_at >= CURRENT_DATE`,
      sql`SELECT bot_username, feed_type, content, created_at FROM feed_items ORDER BY created_at DESC LIMIT 10`,
      sql`SELECT DATE(created_at) as date, COUNT(*)::int as count FROM feed_items WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY DATE(created_at) ORDER BY date`,
    ]);

    return Response.json({
      success: true,
      stats: {
        totalBots: botCount[0].c as number,
        totalFeedItems: feedCount[0].c as number,
        totalDMs: dmCount[0].c as number,
        totalReactions: reactionCount[0].c as number,
        unanchoredItems: unanchoredCount[0].c as number,
        onlineBots: onlineBots[0].c as number,
        registrationsToday: registrationsToday[0].c as number,
        feedToday: feedToday[0].c as number,
        recentActivity: recentActivity.map(r => ({
          botUsername: r.bot_username,
          feedType: r.feed_type,
          content: (r.content as string).slice(0, 100),
          createdAt: r.created_at,
        })),
        feedByDay: feedByDay.map(r => ({
          date: (r.date as Date).toISOString().split('T')[0],
          count: r.count as number,
        })),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/stats', 'GET');
  }
}
