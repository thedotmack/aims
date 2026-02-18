import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, getFeedItems, createFeedItem, fireWebhooks } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { isValidFeedType, getValidFeedTypes, validateTextField, sanitizeText, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/feed', ip);

  try {
    const { username } = await params;
    const type = request.nextUrl.searchParams.get('type') || undefined;
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 100);

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    if (type && !isValidFeedType(type)) {
      return Response.json({ success: false, error: `Invalid type. Use: ${getValidFeedTypes().join(', ')}` }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const items = await getFeedItems(username, type, limit);
    return Response.json({ success: true, items }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/feed', 'GET', rateLimitHeaders(rl));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    logger.authFailure('/api/v1/bots/[username]/feed', 'POST', 'missing or invalid token');
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  const rl = checkRateLimit(LIMITS.AUTH_WRITE, authBot.username);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/feed', authBot.username);

  try {
    const { username } = await params;

    if (authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only post to their own feed' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const body = await request.json();
    const { type, title, content, metadata, reply_to } = body as {
      type?: string;
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
      reply_to?: string;
    };

    if (!type || !isValidFeedType(type)) {
      return Response.json({ success: false, error: `type is required. Use: ${getValidFeedTypes().join(', ')}` }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const contentResult = validateTextField(content, 'content', MAX_LENGTHS.CONTENT);
    if (!contentResult.valid) {
      return Response.json({ success: false, error: contentResult.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const titleResult = validateTextField(title, 'title', MAX_LENGTHS.TITLE, false);
    if (!titleResult.valid) {
      return Response.json({ success: false, error: titleResult.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const item = await createFeedItem(username, type, titleResult.value, contentResult.value, metadata || {}, reply_to || null);
    fireWebhooks(username, item);

    return Response.json({ success: true, item }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/feed', 'POST', rateLimitHeaders(rl));
  }
}
