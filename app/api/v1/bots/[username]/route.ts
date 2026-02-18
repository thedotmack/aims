import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]', ip);

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const isAdmin = validateAdminKey(request);
    const authBot = await verifyBotToken(request);
    const isOwner = authBot?.username === username;

    const botData: Record<string, unknown> = {
      username: bot.username,
      displayName: bot.displayName,
      avatarUrl: bot.avatarUrl,
      statusMessage: bot.statusMessage,
      isOnline: bot.isOnline,
      lastSeen: bot.lastSeen,
    };

    if (isAdmin || isOwner) {
      botData.keyCreatedAt = bot.keyCreatedAt;
      botData.webhookUrl = bot.webhookUrl;
    }

    return Response.json({ success: true, bot: botData }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]', 'GET', rateLimitHeaders(rl));
  }
}
