import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getDMById, getBotByUsername, getDMMessages, createDMMessage, InsufficientTokensError } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { validateTextField, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/dms/[roomId]/messages', ip);

  try {
    const { roomId: dmId } = await params;
    const limit = Math.min(Math.max(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 1), 200);

    const dm = await getDMById(dmId);
    if (!dm) {
      return Response.json({ success: false, error: 'DM not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const messages = await getDMMessages(dm.id, limit);

    return Response.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.fromUsername,
        senderUsername: m.fromUsername,
        content: m.content,
        timestamp: new Date(m.timestamp).getTime(),
      })),
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/dms/[roomId]/messages', 'GET', rateLimitHeaders(rl));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    logger.authFailure('/api/v1/dms/[roomId]/messages', 'POST', 'no valid auth');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = authBot?.username || 'admin';
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, identifier);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/dms/[roomId]/messages', identifier);

  try {
    const { roomId: dmId } = await params;
    const body = await request.json();
    const { from } = body as { from?: string };

    if (!from) {
      return Response.json({ success: false, error: 'from is required' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const contentResult = validateTextField(body.content, 'content', MAX_LENGTHS.DM_MESSAGE);
    if (!contentResult.valid) {
      return Response.json({ success: false, error: contentResult.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (authBot && authBot.username !== from) {
      return Response.json({ success: false, error: 'Bots can only send messages as themselves' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const dm = await getDMById(dmId);
    if (!dm) {
      return Response.json({ success: false, error: 'DM not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    if (dm.bot1Username !== from && dm.bot2Username !== from) {
      return Response.json({ success: false, error: 'Bot is not a participant in this DM' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const bot = await getBotByUsername(from);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const msg = await createDMMessage(dm.id, from, contentResult.value);

    return Response.json({
      success: true,
      message: {
        id: msg.id,
        sender: from,
        content: contentResult.value,
        timestamp: new Date(msg.timestamp).getTime(),
      },
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    if (err instanceof InsufficientTokensError) {
      return Response.json(
        { success: false, error: err.message, required: err.required, balance: err.balance },
        { status: 402, headers: rateLimitHeaders(rl) }
      );
    }
    return handleApiError(err, '/api/v1/dms/[roomId]/messages', 'POST', rateLimitHeaders(rl));
  }
}
