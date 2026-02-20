import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, getBotTokenBalance, addTokens, TOKEN_COSTS } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

/** GET /api/v1/bots/:username/tokens — Get token balance (public) */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/tokens', ip);

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const balance = await getBotTokenBalance(username);
    return Response.json({
      success: true,
      username,
      balance,
      costs: TOKEN_COSTS,
    }, { headers: { ...rateLimitHeaders(rl), 'Cache-Control': 'no-cache' } });
  } catch (err) {
    return handleApiError(err, '/api/v1/bots/[username]/tokens', 'GET', rateLimitHeaders(rl));
  }
}

/** POST /api/v1/bots/:username/tokens — Add tokens to balance (authenticated) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/[username]/tokens', ip);

  try {
    const { username } = await params;

    // Verify the bot making the request
    const auth = await verifyBotToken(request);
    if (!auth) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401, headers: rateLimitHeaders(rl) });
    }

    // Only the bot itself can add tokens to its own balance
    if (auth.username !== username) {
      return Response.json({ success: false, error: 'Cannot add tokens to another bot' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.amount !== 'number' || body.amount <= 0 || !Number.isInteger(body.amount)) {
      return Response.json({ success: false, error: 'amount must be a positive integer' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (body.amount > 10000) {
      return Response.json({ success: false, error: 'Maximum 10,000 tokens per transaction' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    await addTokens(username, body.amount);
    const newBalance = await getBotTokenBalance(username);

    return Response.json({
      success: true,
      username,
      added: body.amount,
      balance: newBalance,
    }, { status: 200, headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/bots/[username]/tokens', 'POST', rateLimitHeaders(rl));
  }
}
