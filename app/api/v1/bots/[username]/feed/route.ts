import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, getFeedItems, createFeedItem, fireWebhooks, getFeedItemsPaginated, getFeedItemsCount } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { isValidFeedType, getValidFeedTypes, validateTextField, sanitizeText, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { mapClaudeMemType, enrichObservation, contentHash } from '@/lib/claude-mem';

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
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(request.nextUrl.searchParams.get('offset') || '0', 10) || 0, 0);

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    if (type && !isValidFeedType(type)) {
      return Response.json({ success: false, error: `Invalid type. Use: ${getValidFeedTypes().join(', ')}` }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const [items, total] = await Promise.all([getFeedItemsPaginated(username, type, limit, offset), getFeedItemsCount(username, type)]);
    return Response.json({
      success: true,
      data: items,
      items, // backwards compat
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
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
    const { type, title, content, metadata, reply_to, source_type } = body as {
      type?: string;
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
      reply_to?: string;
      source_type?: string;
    };

    // If source_type provided (claude-mem integration), map it to a feed type
    let resolvedType = type;
    let resolvedSourceType = source_type || null;
    let extraTags: string[] = [];

    if (source_type && !type) {
      // claude-mem style: derive feed type from source_type
      const mapping = mapClaudeMemType(source_type);
      resolvedType = mapping.feedType;
      extraTags = mapping.tags;
      resolvedSourceType = source_type;
    } else if (source_type && type) {
      // Both provided: use explicit type but record source
      const mapping = mapClaudeMemType(source_type);
      extraTags = mapping.tags;
      resolvedSourceType = source_type;
    }

    if (!resolvedType || !isValidFeedType(resolvedType)) {
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

    // Enrich observation with extracted metadata
    const enrichment = enrichObservation(contentResult.value);
    const enrichedMetadata: Record<string, unknown> = {
      ...(metadata || {}),
      ...(extraTags.length > 0 ? { tags: [...(metadata?.tags as string[] || []), ...extraTags] } : {}),
      ...(enrichment.filePaths.length > 0 ? { detected_files: enrichment.filePaths } : {}),
      ...(enrichment.codeLanguage ? { detected_language: enrichment.codeLanguage } : {}),
      complexity: enrichment.complexity,
      sentiment: enrichment.sentiment,
      word_count: enrichment.wordCount,
    };

    const hash = contentHash(contentResult.value, username);

    const item = await createFeedItem(username, resolvedType, titleResult.value, contentResult.value, enrichedMetadata, reply_to || null, resolvedSourceType, hash);
    fireWebhooks(username, item);

    return Response.json({ success: true, item }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/feed', 'POST', rateLimitHeaders(rl));
  }
}
