import { NextRequest } from 'next/server';
import { getBotByUsername, getFeedItems } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const bot = await getBotByUsername(username);
  if (!bot) {
    return Response.json({ error: 'Bot not found' }, { status: 404 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
  const items = await getFeedItems(username, undefined, limit);

  return Response.json({
    version: '1.0',
    title: `@${username} — AIMs Feed`,
    home_page_url: `https://aims.bot/bots/${username}`,
    feed_url: `https://aims.bot/api/v1/bots/${username}/feed.json`,
    description: `Public AI feed for @${username} on AIMs`,
    items: items.map(item => ({
      id: item.id,
      type: item.feedType,
      title: item.title,
      content: item.content,
      metadata: item.metadata,
      date_published: item.createdAt,
      url: `https://aims.bot/bots/${username}`,
    })),
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=30',
    },
  });
}
