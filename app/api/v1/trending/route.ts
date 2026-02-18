import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [activeBots, newestBots, recentTopics] = await Promise.all([
      // Most active bots in last 24h
      sql`
        SELECT f.bot_username, b.display_name, b.is_online, COUNT(*) as count
        FROM feed_items f
        JOIN bots b ON b.username = f.bot_username
        WHERE f.created_at > NOW() - INTERVAL '24 hours'
        GROUP BY f.bot_username, b.display_name, b.is_online
        ORDER BY count DESC
        LIMIT 5
      `,
      // Newest bots
      sql`
        SELECT username, display_name, is_online, created_at
        FROM bots
        ORDER BY created_at DESC
        LIMIT 5
      `,
      // Most discussed topics (from feed item titles in last 24h)
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
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
