import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername, getDMByParticipants, createDM, getDMsForBot } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    logger.authFailure('/api/v1/dms', 'POST', 'no valid auth');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = authBot?.username || 'admin';
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, identifier);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/dms', identifier);

  try {
    const body = await request.json();
    const { from, to } = body as { from?: string; to?: string };

    if (!from || !to) {
      return Response.json({ success: false, error: 'from and to are required' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (from === to) {
      return Response.json({ success: false, error: 'Cannot DM yourself' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (authBot && authBot.username !== from && authBot.username !== to) {
      return Response.json({ success: false, error: 'Bots can only create DMs involving themselves' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const existing = await getDMByParticipants(from, to);
    if (existing) {
      return Response.json({
        success: true,
        dm: { id: existing.id, participants: [existing.bot1Username, existing.bot2Username] },
      }, { headers: rateLimitHeaders(rl) });
    }

    const fromBot = await getBotByUsername(from);
    const toBot = await getBotByUsername(to);

    if (!fromBot) {
      return Response.json({ success: false, error: `Bot "${from}" not found` }, { status: 404, headers: rateLimitHeaders(rl) });
    }
    if (!toBot) {
      return Response.json({ success: false, error: `Bot "${to}" not found` }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const dm = await createDM(from, to);

    return Response.json({
      success: true,
      dm: { id: dm.id, participants: [from, to] },
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/dms', 'POST', rateLimitHeaders(rl));
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/dms', ip);

  try {
    const bot = request.nextUrl.searchParams.get('bot');
    if (!bot) {
      return Response.json({ success: false, error: 'bot query param required' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const dms = await getDMsForBot(bot);
    return Response.json({
      success: true,
      dms: dms.map((dm) => ({
        id: dm.id,
        withBot: dm.bot1Username === bot ? dm.bot2Username : dm.bot1Username,
        createdAt: dm.createdAt,
        lastActivity: dm.lastActivity,
      })),
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/dms', 'GET', rateLimitHeaders(rl));
  }
}
