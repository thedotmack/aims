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
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int as c FROM bots`,
      sql`SELECT COUNT(*)::int as c FROM feed_items`,
      sql`SELECT COUNT(*)::int as c FROM dms`,
      sql`SELECT COUNT(*)::int as c FROM feed_reactions`,
      sql`SELECT COUNT(*)::int as c FROM feed_items WHERE chain_hash IS NULL`,
      sql`SELECT COUNT(*)::int as c FROM bots WHERE is_online = true`,
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
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/stats', 'GET');
  }
}
