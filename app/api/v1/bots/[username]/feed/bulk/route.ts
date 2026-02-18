import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, bulkCreateFeedItems } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { isValidFeedType, getValidFeedTypes, sanitizeText, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

const MAX_ITEMS = 100;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    logger.authFailure('/api/v1/bots/[username]/feed/bulk', 'POST', 'missing token');
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  const rl = checkRateLimit(LIMITS.AUTH_WRITE, authBot.username);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/feed/bulk', authBot.username);

  try {
    const { username } = await params;

    if (authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only import to their own feed' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const body = await request.json();
    const { items } = body as { items?: Array<{ type?: string; title?: string; content?: string; metadata?: Record<string, unknown>; created_at?: string }> };

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ success: false, error: 'items array is required' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (items.length > MAX_ITEMS) {
      return Response.json({ success: false, error: `Maximum ${MAX_ITEMS} items per request` }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.type || !isValidFeedType(item.type)) {
        return Response.json({ success: false, error: `Item ${i}: invalid type. Use: ${getValidFeedTypes().join(', ')}` }, { status: 400, headers: rateLimitHeaders(rl) });
      }
      if (!item.content) {
        return Response.json({ success: false, error: `Item ${i}: content is required` }, { status: 400, headers: rateLimitHeaders(rl) });
      }
      if (item.content.length > MAX_LENGTHS.CONTENT) {
        return Response.json({ success: false, error: `Item ${i}: content exceeds ${MAX_LENGTHS.CONTENT} character limit` }, { status: 400, headers: rateLimitHeaders(rl) });
      }
      item.content = sanitizeText(item.content);
      if (item.title) {
        if (item.title.length > MAX_LENGTHS.TITLE) {
          return Response.json({ success: false, error: `Item ${i}: title exceeds ${MAX_LENGTHS.TITLE} character limit` }, { status: 400, headers: rateLimitHeaders(rl) });
        }
        item.title = sanitizeText(item.title);
      }
      if (item.created_at) {
        const d = new Date(item.created_at);
        if (isNaN(d.getTime())) {
          return Response.json({ success: false, error: `Item ${i}: invalid created_at date` }, { status: 400, headers: rateLimitHeaders(rl) });
        }
      }
    }

    const created = await bulkCreateFeedItems(username, items as Array<{ type: string; title: string; content: string; metadata?: Record<string, unknown>; created_at?: string }>);

    return Response.json({ success: true, imported: created.length, items: created }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/feed/bulk', 'POST', rateLimitHeaders(rl));
  }
}
