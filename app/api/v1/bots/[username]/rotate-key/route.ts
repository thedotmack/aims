import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, generateApiKey, rotateApiKey } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    logger.authFailure('/api/v1/bots/[username]/rotate-key', 'POST', 'missing token');
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  const rl = checkRateLimit(LIMITS.AUTH_WRITE, authBot.username);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/rotate-key', authBot.username);

  try {
    const { username } = await params;

    if (authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only rotate their own key' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const newKey = generateApiKey();
    await rotateApiKey(username, newKey);

    logger.info('API key rotated', { endpoint: '/api/v1/bots/[username]/rotate-key', username });

    return Response.json({
      success: true,
      api_key: newKey,
      message: 'API key rotated. Old key is now invalid. Save this new key — it will not be shown again.',
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/rotate-key', 'POST', rateLimitHeaders(rl));
  }
}
