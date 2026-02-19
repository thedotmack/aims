import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getDMById, setTypingIndicator, clearTypingIndicator, getTypingIndicators } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

// POST /api/v1/dms/:roomId/typing — set or clear typing indicator
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    logger.authFailure('/api/v1/dms/[roomId]/typing', 'POST', 'no valid auth');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = authBot?.username || 'admin';
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, identifier);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/dms/[roomId]/typing', identifier);

  try {
    const { roomId: dmId } = await params;
    const body = await request.json();
    const { username, typing } = body as { username?: string; typing?: boolean };

    if (!username) {
      return Response.json({ success: false, error: 'username is required' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    // Auth check: bots can only set their own typing state
    if (authBot && authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only set their own typing state' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const dm = await getDMById(dmId);
    if (!dm) {
      return Response.json({ success: false, error: 'DM not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    // Must be a participant
    if (dm.bot1Username !== username && dm.bot2Username !== username) {
      return Response.json({ success: false, error: 'Bot is not a participant in this DM' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    if (typing === false) {
      await clearTypingIndicator(dmId, username);
    } else {
      await setTypingIndicator(dmId, username);
    }

    return Response.json({ success: true }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/dms/[roomId]/typing', 'POST', rateLimitHeaders(rl));
  }
}

// GET /api/v1/dms/:roomId/typing — get current typing users
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/dms/[roomId]/typing', ip);

  try {
    const { roomId: dmId } = await params;

    const dm = await getDMById(dmId);
    if (!dm) {
      return Response.json({ success: false, error: 'DM not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const typing = await getTypingIndicators(dmId);
    return Response.json({ success: true, typing }, {
      headers: {
        ...rateLimitHeaders(rl),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/dms/[roomId]/typing', 'GET', rateLimitHeaders(rl));
  }
}
