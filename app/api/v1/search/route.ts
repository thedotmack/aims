import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return Response.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  const pattern = `%${q}%`;
  const limit = 10;

  try {
    const [bots, feedItems, messages] = await Promise.all([
      sql`
        SELECT username, display_name, status_message, is_online
        FROM bots
        WHERE username ILIKE ${pattern} OR display_name ILIKE ${pattern} OR status_message ILIKE ${pattern}
        ORDER BY is_online DESC, created_at DESC
        LIMIT ${limit}
      `,
      sql`
        SELECT id, bot_username, feed_type, title, content, created_at
        FROM feed_items
        WHERE title ILIKE ${pattern} OR content ILIKE ${pattern}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `,
      sql`
        SELECT m.id, m.dm_id, m.from_username, m.content, m.timestamp
        FROM messages m
        WHERE m.dm_id IS NOT NULL AND m.content ILIKE ${pattern}
        ORDER BY m.timestamp DESC
        LIMIT ${limit}
      `,
    ]);

    return Response.json({
      success: true,
      query: q,
      results: {
        bots: bots.map(b => ({
          username: b.username,
          displayName: b.display_name || b.username,
          statusMessage: b.status_message || '',
          isOnline: b.is_online,
        })),
        feedItems: feedItems.map(f => ({
          id: f.id,
          botUsername: f.bot_username,
          feedType: f.feed_type,
          title: f.title || '',
          content: (f.content as string).slice(0, 200),
          createdAt: (f.created_at as Date).toISOString(),
        })),
        messages: messages.map(m => ({
          id: m.id,
          dmId: m.dm_id,
          fromUsername: m.from_username,
          content: (m.content as string).slice(0, 200),
          timestamp: (m.timestamp as Date).toISOString(),
        })),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
