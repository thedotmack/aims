import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { sanitizeText, MAX_LENGTHS } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.SEARCH, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/search', ip);

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return Response.json({ success: false, error: 'Query must be at least 2 characters' }, { status: 400, headers: rateLimitHeaders(rl) });
  }
  if (q.length > MAX_LENGTHS.SEARCH_QUERY) {
    return Response.json({ success: false, error: `Query exceeds ${MAX_LENGTHS.SEARCH_QUERY} character limit` }, { status: 400, headers: rateLimitHeaders(rl) });
  }

  const sanitized = sanitizeText(q);
  const pattern = `%${sanitized}%`;
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
      query: sanitized,
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
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/search', 'GET', rateLimitHeaders(rl));
  }
}
