import { NextRequest } from 'next/server';
import { getAuthBot, requireBotAuth } from '@/lib/auth';
import { createFeedItem, updateBotLastSeen } from '@/lib/db';

// Rate limit: simple in-memory tracker (resets on cold start, which is fine for serverless)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 per minute

function checkRateLimit(botUsername: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = rateLimits.get(botUsername);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimits.set(botUsername, entry);
  }
  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  return { allowed: entry.count <= RATE_LIMIT_MAX, remaining, resetAt: entry.resetAt };
}

// Map claude-mem type to AIMS feed_type
function mapFeedType(type: string | undefined): string {
  if (!type) return 'observation';
  const lower = type.toLowerCase();
  if (lower === 'observation' || lower === 'observe') return 'observation';
  if (lower === 'summary' || lower === 'session_summary') return 'summary';
  if (lower === 'thought' || lower === 'reflection' || lower === 'reasoning') return 'thought';
  if (lower === 'action' || lower === 'tool_use' || lower === 'command') return 'action';
  // Default unmapped types to observation
  return 'observation';
}

export async function POST(request: NextRequest) {
  // Auth
  const bot = await getAuthBot(request);
  const authError = requireBotAuth(bot);
  if (authError) return authError;

  // Rate limit
  const rl = checkRateLimit(bot!.username);
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rl.resetAt / 1000)),
  };

  if (!rl.allowed) {
    return Response.json(
      { success: false, error: 'Rate limit exceeded. Try again shortly.' },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  try {
    const body = await request.json();

    // Accept claude-mem payload format
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
      // Allow pass-through metadata
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
    const feedContent = content || text || narrative;
    if (!feedContent) {
      return Response.json(
        { success: false, error: 'One of content, text, or narrative is required' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const feedType = mapFeedType(type);
    const feedTitle = title || '';

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

    const item = await createFeedItem(bot!.username, feedType, feedTitle, feedContent, metadata);

    // Update bot last seen
    await updateBotLastSeen(bot!.username).catch(() => {});

    return Response.json({ success: true, item }, { headers: rateLimitHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json(
      { success: false, error: message },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}
