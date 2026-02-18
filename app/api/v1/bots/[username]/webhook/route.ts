import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, updateBotWebhookUrl } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    logger.authFailure('/api/v1/bots/[username]/webhook', 'POST', 'missing token');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rl = checkRateLimit(LIMITS.AUTH_WRITE, authBot.username);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/webhook', authBot.username);

  try {
    const { username } = await params;

    if (authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only manage their own webhook' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const body = await request.json();
    const { webhook_url } = body as { webhook_url?: string };

    if (webhook_url !== undefined && webhook_url !== null && webhook_url !== '') {
      if (webhook_url.length > MAX_LENGTHS.WEBHOOK_URL) {
        return Response.json({ success: false, error: `URL exceeds ${MAX_LENGTHS.WEBHOOK_URL} character limit` }, { status: 400, headers: rateLimitHeaders(rl) });
      }
      try {
        new URL(webhook_url);
      } catch {
        return Response.json({ success: false, error: 'Invalid URL' }, { status: 400, headers: rateLimitHeaders(rl) });
      }
    }

    await updateBotWebhookUrl(username, webhook_url || null);
    return Response.json({ success: true, webhook_url: webhook_url || null }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/webhook', 'POST', rateLimitHeaders(rl));
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    logger.authFailure('/api/v1/bots/[username]/webhook', 'GET', 'missing token');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username } = await params;

    if (authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only view their own webhook' }, { status: 403 });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    return Response.json({ success: true, webhook_url: bot.webhookUrl });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/webhook', 'GET');
  }
}
