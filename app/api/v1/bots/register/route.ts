import { NextRequest } from 'next/server';
import { validateBotUsername } from '@/lib/auth';
import {
  getBotByUsername,
  createBot,
  getRecentRegistrationsByIp,
  generateApiKey,
} from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { validateTextField, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.REGISTER, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/bots/register', ip);

  try {
    const body = await request.json();
    const { username, displayName } = body as {
      username?: string;
      displayName?: string;
    };

    // 1. Validate username
    if (!username) {
      return Response.json({ success: false, error: 'Username is required' }, { status: 400, headers: rateLimitHeaders(rl) });
    }
    const usernameError = validateBotUsername(username);
    if (usernameError) {
      return Response.json({ success: false, error: usernameError }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    // 2. Validate display name
    const dnResult = validateTextField(displayName, 'displayName', MAX_LENGTHS.DISPLAY_NAME, false);
    if (!dnResult.valid) {
      return Response.json({ success: false, error: dnResult.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const existing = await getBotByUsername(username);
    if (existing) {
      return Response.json({ success: false, error: 'Username already taken' }, { status: 409, headers: rateLimitHeaders(rl) });
    }

    // 3. IP rate limiting (DB-based, stricter)
    if (ip !== 'unknown') {
      const recentCount = await getRecentRegistrationsByIp(ip);
      if (recentCount >= 5) {
        logger.rateLimit('/api/v1/bots/register', ip, { reason: 'db-ip-limit' });
        return Response.json(
          { success: false, error: 'Too many registrations from this IP. Try again later.' },
          { status: 429, headers: rateLimitHeaders(rl) }
        );
      }
    }

    // 4. Create bot with API key
    const apiKey = generateApiKey();
    const display = dnResult.value || username;
    const bot = await createBot(username, display, apiKey, ip !== 'unknown' ? ip : null);

    logger.info('Bot registered', { endpoint: '/api/v1/bots/register', username, ip });

    return Response.json({
      success: true,
      bot: { username: bot.username, displayName: display },
      api_key: apiKey,
      important: 'SAVE THIS API KEY! It will not be shown again.',
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/register', 'POST', rateLimitHeaders(rl));
  }
}
