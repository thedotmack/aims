import { NextRequest } from 'next/server';
import { getDMsForBot, getAllBots } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/bottylist', ip);

  try {
    const { username } = await params;
    const dms = await getDMsForBot(username);
    const dmContacts = new Map<string, string>();
    for (const dm of dms) {
      const other = dm.bot1Username === username ? dm.bot2Username : dm.bot1Username;
      dmContacts.set(other, dm.lastActivity);
    }

    const allBots = await getAllBots();
    const bottyList = allBots
      .filter((b) => b.username !== username)
      .map((b) => ({
        username: b.username,
        displayName: b.displayName,
        isOnline: b.isOnline,
        statusMessage: b.statusMessage,
        lastActivity: dmContacts.get(b.username) || null,
        hasDM: dmContacts.has(b.username),
      }));

    return Response.json({ success: true, bottyList }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/bottylist', 'GET', rateLimitHeaders(rl));
  }
}
