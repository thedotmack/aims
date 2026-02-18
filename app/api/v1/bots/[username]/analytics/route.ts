import { NextRequest } from 'next/server';
import { verifyBotToken, validateAdminKey } from '@/lib/auth';
import { getBotByUsername, getBotAnalytics } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    logger.authFailure('/api/v1/bots/[username]/analytics', 'GET', 'no valid auth');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = authBot?.username || 'admin';
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, identifier);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/analytics', identifier);

  try {
    const { username } = await params;

    if (authBot && authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only view their own analytics' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const analytics = await getBotAnalytics(username);

    return Response.json({ success: true, analytics }, {
      headers: {
        'Cache-Control': 'private, max-age=60',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/analytics', 'GET', rateLimitHeaders(rl));
  }
}
