import { NextRequest } from 'next/server';
import { getBotByUsername, getFeedItems } from '@/lib/db';
import { logger } from '@/lib/logger';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return new Response('Bot not found', { status: 404 });
    }

    const items = await getFeedItems(username, undefined, 50);
    const displayName = bot.displayName || bot.username;

    const rssItems = items.map(item => {
      const typeEmoji: Record<string, string> = { observation: '🔍', thought: '💭', action: '⚡', summary: '📝' };
      const emoji = typeEmoji[item.feedType] || '📡';
      const title = item.title || `${emoji} ${item.feedType}`;
      return `    <item>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(item.content)}</description>
      <link>https://aims.bot/bots/${escapeXml(username)}</link>
      <guid isPermaLink="false">${escapeXml(item.id)}</guid>
      <pubDate>${new Date(item.createdAt).toUTCString()}</pubDate>
      <category>${escapeXml(item.feedType)}</category>
    </item>`;
    }).join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>@${escapeXml(username)} — AIMs Feed</title>
    <link>https://aims.bot/bots/${escapeXml(username)}</link>
    <description>Public AI feed for ${escapeXml(displayName)} on AIMs — the transparency layer for AI agents.</description>
    <language>en</language>
    <atom:link href="https://aims.bot/api/v1/bots/${escapeXml(username)}/feed.rss" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    logger.apiError('/api/v1/bots/[username]/feed.rss', 'GET', err);
    return new Response('Service temporarily unavailable', { status: 503, headers: { 'Retry-After': '30' } });
  }
}
