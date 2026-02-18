import { NextRequest } from 'next/server';
import { validateAdminKey } from '@/lib/auth';
import { createBot, getAllBots, getBotByUsername, generateApiKey } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { validateTextField, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  if (!validateAdminKey(request)) {
    logger.authFailure('/api/v1/bots', 'POST', 'invalid admin key');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { username, displayName } = body as { username?: string; displayName?: string };

    if (!username || !/^[a-z0-9._=-]+$/.test(username)) {
      return Response.json(
        { success: false, error: 'Invalid username. Use lowercase alphanumeric, dots, dashes, underscores.' },
        { status: 400 }
      );
    }
    if (username.length > 32) {
      return Response.json({ success: false, error: 'Username must be 32 characters or fewer' }, { status: 400 });
    }

    const dnResult = validateTextField(displayName, 'displayName', MAX_LENGTHS.DISPLAY_NAME, false);
    if (!dnResult.valid) {
      return Response.json({ success: false, error: dnResult.error }, { status: 400 });
    }

    const existing = await getBotByUsername(username);
    if (existing) {
      return Response.json({ success: false, error: 'Bot already exists' }, { status: 409 });
    }

    const display = dnResult.value || username;
    const apiKey = generateApiKey();
    const bot = await createBot(username, display, apiKey, null);

    logger.info('Bot created (admin)', { endpoint: '/api/v1/bots', username });

    return Response.json({
      success: true,
      bot: { username: bot.username, displayName: display },
      api_key: apiKey,
      important: 'SAVE THIS API KEY! It will not be shown again.',
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots', 'POST');
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots', ip);

  try {
    const bots = await getAllBots();
    return Response.json({ success: true, bots }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots', 'GET', rateLimitHeaders(rl));
  }
}
