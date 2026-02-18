import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { createFeedItem, feedItemExistsByHash } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { isValidFeedType, sanitizeText, MAX_LENGTHS } from '@/lib/validation';
import { mapClaudeMemType, enrichObservation, contentHash } from '@/lib/claude-mem';
import { logger } from '@/lib/logger';

const MAX_ITEMS = 100;

interface ImportItem {
  source_type?: string;
  type?: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export async function POST(request: NextRequest) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    logger.authFailure('/api/v1/webhooks/import', 'POST', 'missing token');
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  const rl = checkRateLimit(LIMITS.AUTH_WRITE, authBot.username);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/webhooks/import', authBot.username);

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON payload' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const { items } = (body as { items?: ImportItem[] }) || {};

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ success: false, error: 'items array is required and must not be empty' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (items.length > MAX_ITEMS) {
      return Response.json({ success: false, error: `Maximum ${MAX_ITEMS} items per request` }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    let imported = 0;
    let skipped = 0;
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      try {
        // Validate content
        if (!item.content || typeof item.content !== 'string') {
          errors.push({ index: i, error: 'content is required' });
          continue;
        }
        if (item.content.length > MAX_LENGTHS.CONTENT) {
          errors.push({ index: i, error: `content exceeds ${MAX_LENGTHS.CONTENT} char limit` });
          continue;
        }

        // Resolve type from source_type or explicit type
        let feedType = item.type;
        let sourceType = item.source_type || null;
        let extraTags: string[] = [];

        if (item.source_type && !item.type) {
          const mapping = mapClaudeMemType(item.source_type);
          feedType = mapping.feedType;
          extraTags = mapping.tags;
          sourceType = item.source_type;
        } else if (item.source_type) {
          const mapping = mapClaudeMemType(item.source_type);
          extraTags = mapping.tags;
        }

        if (!feedType || !isValidFeedType(feedType)) {
          errors.push({ index: i, error: 'type or source_type is required' });
          continue;
        }

        // Validate created_at if provided
        if (item.created_at) {
          const d = new Date(item.created_at);
          if (isNaN(d.getTime())) {
            errors.push({ index: i, error: 'invalid created_at date' });
            continue;
          }
        }

        // Deduplication check
        const hash = contentHash(sanitizeText(item.content), authBot.username);
        const exists = await feedItemExistsByHash(hash);
        if (exists) {
          skipped++;
          continue;
        }

        // Enrich
        const sanitized = sanitizeText(item.content);
        const enrichment = enrichObservation(sanitized);
        const enrichedMetadata: Record<string, unknown> = {
          ...(item.metadata || {}),
          ...(extraTags.length > 0 ? { tags: [...((item.metadata?.tags as string[]) || []), ...extraTags] } : {}),
          ...(enrichment.filePaths.length > 0 ? { detected_files: enrichment.filePaths } : {}),
          ...(enrichment.codeLanguage ? { detected_language: enrichment.codeLanguage } : {}),
          complexity: enrichment.complexity,
          sentiment: enrichment.sentiment,
          word_count: enrichment.wordCount,
          bulk_imported: true,
        };

        const title = item.title ? sanitizeText(item.title).slice(0, MAX_LENGTHS.TITLE) : '';

        await createFeedItem(
          authBot.username,
          feedType,
          title,
          sanitized,
          enrichedMetadata,
          null,
          sourceType,
          hash
        );
        imported++;
      } catch (err) {
        errors.push({ index: i, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return Response.json({
      success: true,
      imported,
      skipped,
      errors,
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/webhooks/import', 'POST', rateLimitHeaders(rl));
  }
}
