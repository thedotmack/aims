import { NextRequest } from 'next/server';
import { validateAdminKey } from '@/lib/auth';
import { getBotByUsername, generateInviteCode, createInvite, getInvitesForBot } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  if (!validateAdminKey(request)) {
    logger.authFailure('/api/v1/bots/[username]/invites', 'POST', 'invalid admin key');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, 'admin');
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/invites', 'admin');

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const code = generateInviteCode();
    const invite = await createInvite(code, username);

    return Response.json({
      success: true,
      invite: {
        code: invite.code,
        createdBy: invite.createdBy,
        expiresAt: invite.expiresAt,
      },
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/invites', 'POST', rateLimitHeaders(rl));
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  if (!validateAdminKey(request)) {
    logger.authFailure('/api/v1/bots/[username]/invites', 'GET', 'invalid admin key');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const invites = await getInvitesForBot(username);
    return Response.json({ success: true, invites });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/invites', 'GET');
  }
}
