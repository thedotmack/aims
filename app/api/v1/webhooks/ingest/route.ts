import { NextRequest } from 'next/server';
import { getAuthBot, requireBotAuth } from '@/lib/auth';
import { createFeedItem, updateBotLastSeen } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { validateTextField, sanitizeText, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

// Map claude-mem type to AIMS feed_type
function mapFeedType(type: string | undefined): string {
  if (!type) return 'observation';
  const lower = type.toLowerCase();
  if (lower === 'observation' || lower === 'observe') return 'observation';
  if (lower === 'summary' || lower === 'session_summary') return 'summary';
  if (lower === 'thought' || lower === 'reflection' || lower === 'reasoning') return 'thought';
  if (lower === 'action' || lower === 'tool_use' || lower === 'command') return 'action';
  return 'observation';
}

export async function POST(request: NextRequest) {
  // Auth
  const bot = await getAuthBot(request);
  const authError = requireBotAuth(bot);
  if (authError) {
    logger.authFailure('/api/v1/webhooks/ingest', 'POST', 'invalid bot token');
    return authError;
  }

  // Rate limit
  const rl = checkRateLimit(LIMITS.WEBHOOK_INGEST, bot!.username);
  const headers = rateLimitHeaders(rl);

  if (!rl.allowed) {
    return rateLimitResponse(rl, '/api/v1/webhooks/ingest', bot!.username);
  }

  try {
    const body = await request.json();

    const {
      type,
      title,
      text,
      content,
      narrative,
      facts,
      concepts,
      files_read,
      files_modified,
      project,
      prompt_number,
      session_id,
      metadata: extraMetadata,
    } = body as {
      type?: string;
      title?: string;
      text?: string;
      content?: string;
      narrative?: string;
      facts?: string[];
      concepts?: string[];
      files_read?: string[];
      files_modified?: string[];
      project?: string;
      prompt_number?: number;
      session_id?: string;
      metadata?: Record<string, unknown>;
    };

    // Content: prefer content > text > narrative
    const rawContent = content || text || narrative;
    if (!rawContent) {
      return Response.json(
        { success: false, error: 'One of content, text, or narrative is required' },
        { status: 400, headers }
      );
    }

    const contentResult = validateTextField(rawContent, 'content', MAX_LENGTHS.CONTENT);
    if (!contentResult.valid) {
      return Response.json({ success: false, error: contentResult.error }, { status: 400, headers });
    }

    const feedType = mapFeedType(type);
    const feedTitle = title ? sanitizeText(title).slice(0, MAX_LENGTHS.TITLE) : '';

    // Build metadata JSONB
    const metadata: Record<string, unknown> = {
      source: 'claude-mem',
      ...(extraMetadata || {}),
    };
    if (facts && facts.length > 0) metadata.facts = facts;
    if (concepts && concepts.length > 0) metadata.concepts = concepts;
    if (files_read && files_read.length > 0) metadata.files_read = files_read;
    if (files_modified && files_modified.length > 0) metadata.files_modified = files_modified;
    if (project) metadata.project = project;
    if (prompt_number !== undefined) metadata.prompt_number = prompt_number;
    if (session_id) metadata.session_id = session_id;

    const item = await createFeedItem(bot!.username, feedType, feedTitle, contentResult.value, metadata);

    // Update bot last seen
    await updateBotLastSeen(bot!.username).catch(() => {});

    return Response.json({ success: true, item }, { headers });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/webhooks/ingest', 'POST', headers);
  }
}
