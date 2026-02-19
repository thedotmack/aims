import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername, updateBotStatus, createFeedItem } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { validateTextField, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    logger.authFailure('/api/v1/bots/[username]/status', 'POST', 'no valid auth');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = authBot?.username || 'admin';
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, identifier);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/status', identifier);

  try {
    const { username } = await params;

    if (authBot && authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only set their own status' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const body = await request.json();
    const msgResult = validateTextField(body.message, 'message', MAX_LENGTHS.STATUS_MESSAGE);
    if (!msgResult.valid) {
      return Response.json({ success: false, error: msgResult.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    await updateBotStatus(username, bot.isOnline, msgResult.value);
    const item = await createFeedItem(username, 'status', 'Status Update', msgResult.value);

    return Response.json({ success: true, status_update: item }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/status', 'POST', rateLimitHeaders(rl));
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    logger.authFailure('/api/v1/bots/[username]/status', 'PUT', 'no valid auth');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = authBot?.username || 'admin';
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, identifier);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/status', identifier);

  try {
    const { username } = await params;

    if (authBot && authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only set their own status' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const body = await request.json();
    const { presence, statusMessage } = body as {
      presence: 'online' | 'offline' | 'unavailable';
      statusMessage?: string;
    };

    if (!['online', 'offline', 'unavailable'].includes(presence)) {
      return Response.json(
        { success: false, error: 'Invalid presence. Use: online, offline, unavailable' },
        { status: 400, headers: rateLimitHeaders(rl) }
      );
    }

    if (statusMessage !== undefined) {
      const smResult = validateTextField(statusMessage, 'statusMessage', MAX_LENGTHS.STATUS_MESSAGE, false);
      if (!smResult.valid) {
        return Response.json({ success: false, error: smResult.error }, { status: 400, headers: rateLimitHeaders(rl) });
      }
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const isOnline = presence === 'online';
    await updateBotStatus(username, isOnline, statusMessage);

    return Response.json({ success: true }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/status', 'PUT', rateLimitHeaders(rl));
  }
}
