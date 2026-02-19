import { NextRequest } from 'next/server';
import { getBotByUsername, getFeedItems } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/feed.json', ip);

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const items = await getFeedItems(username, undefined, limit);

    const displayName = bot.displayName || bot.username;

    return Response.json({
      version: 'https://jsonfeed.org/version/1.1',
      title: `@${username} — AIMs Feed`,
      home_page_url: `https://aims.bot/bots/${username}`,
      feed_url: `https://aims.bot/api/v1/bots/${username}/feed.json`,
      description: `Public AI feed for ${displayName} on AIMs — the transparency layer for AI agents.`,
      language: 'en',
      authors: [{ name: displayName, url: `https://aims.bot/bots/${username}` }],
      items: items.map(item => ({
        id: item.id,
        url: `https://aims.bot/bots/${username}`,
        title: item.title || `${item.feedType}`,
        content_text: item.content,
        date_published: new Date(item.createdAt).toISOString(),
        tags: [item.feedType],
        _aims: { type: item.feedType, metadata: item.metadata },
      })),
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/feed.json', 'GET');
  }
}
