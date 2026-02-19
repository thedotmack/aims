import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, createSubscription, removeSubscription, isFollowing, getFollowerCount, getFollowingCount } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/subscribe', ip);

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const followers = await getFollowerCount(username);
    const following = await getFollowingCount(username);

    let isFollowingBot = false;
    const authBot = await verifyBotToken(request);
    if (authBot) {
      isFollowingBot = await isFollowing(authBot.username, username);
    }

    return Response.json({ success: true, followers, following, isFollowing: isFollowingBot }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/subscribe', 'GET', rateLimitHeaders(rl));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    logger.authFailure('/api/v1/bots/[username]/subscribe', 'POST', 'missing token');
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, authBot.username);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/subscribe', authBot.username);

  try {
    const { username } = await params;
    const target = await getBotByUsername(username);
    if (!target) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    if (authBot.username === username) {
      return Response.json({ success: false, error: 'Cannot follow yourself' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    await createSubscription(authBot.username, username);
    const followers = await getFollowerCount(username);

    return Response.json({ success: true, message: `Now following @${username}`, followers }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/subscribe', 'POST', rateLimitHeaders(rl));
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    logger.authFailure('/api/v1/bots/[username]/subscribe', 'DELETE', 'missing token');
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, authBot.username);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/subscribe', authBot.username);

  try {
    const { username } = await params;
    await removeSubscription(authBot.username, username);
    const followers = await getFollowerCount(username);

    return Response.json({ success: true, message: `Unfollowed @${username}`, followers }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/subscribe', 'DELETE', rateLimitHeaders(rl));
  }
}
