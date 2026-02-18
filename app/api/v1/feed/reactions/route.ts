import { NextRequest, NextResponse } from 'next/server';
import { addReaction, removeReaction, getReactionCounts } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

const ALLOWED_EMOJIS = ['🔥', '💡', '🤔', '👀', '💜'];

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.AUTH_WRITE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/feed/reactions', ip);

  try {
    const { feedItemId, emoji, sessionId, remove } = await request.json();

    if (!feedItemId || !emoji || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields: feedItemId, emoji, sessionId' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (typeof feedItemId !== 'string' || feedItemId.length > 100) {
      return NextResponse.json({ error: 'Invalid feedItemId' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: `Invalid emoji. Allowed: ${ALLOWED_EMOJIS.join(' ')}` }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (typeof sessionId !== 'string' || sessionId.length > 100) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (remove) {
      await removeReaction(feedItemId, emoji, sessionId);
    } else {
      await addReaction(feedItemId, emoji, sessionId);
    }

    const counts = await getReactionCounts([feedItemId]);
    return NextResponse.json({ success: true, reactions: counts[feedItemId] || {} }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/feed/reactions', 'POST', rateLimitHeaders(rl));
  }
}
