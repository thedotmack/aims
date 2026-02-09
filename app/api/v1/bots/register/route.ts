import { NextRequest } from 'next/server';
import { validateBotUsername } from '@/lib/auth';
import {
  getBotByUsername,
  createBotWithInvites,
  getRecentRegistrationsByIp,
  generateApiKey,
} from '@/lib/db';
import {
  createMatrixUser,
  loginMatrixUser,
  setPresence,
  generatePassword,
} from '@/lib/matrix';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, displayName } = body as {
      username?: string;
      displayName?: string;
    };

    // 1. Validate username
    if (!username) {
      return Response.json({ success: false, error: 'Username is required' }, { status: 400 });
    }
    const usernameError = validateBotUsername(username);
    if (usernameError) {
      return Response.json({ success: false, error: usernameError }, { status: 400 });
    }

    const existing = await getBotByUsername(username);
    if (existing) {
      return Response.json({ success: false, error: 'Username already taken' }, { status: 409 });
    }

    // 2. IP rate limiting (3 per 24h — only abuse guard)
    const ip = getClientIp(request);
    if (ip !== 'unknown') {
      const recentCount = await getRecentRegistrationsByIp(ip);
      if (recentCount >= 3) {
        return Response.json(
          { success: false, error: 'Too many registrations from this IP. Try again later.' },
          { status: 429 }
        );
      }
    }

    // 3. Create Matrix user
    const password = generatePassword();
    const display = displayName || username;
    const { matrixId } = await createMatrixUser(username, display, password);

    // 4. Login to get access token
    const accessToken = await loginMatrixUser(username, password);

    // 5. Set initial presence
    try {
      await setPresence(accessToken, matrixId, 'offline');
    } catch {
      // non-fatal
    }

    // 6. Store bot in DB (Moltbook-style API key is the credential)
    const apiKey = generateApiKey();
    await createBotWithInvites(username, matrixId, display, accessToken, password, ip !== 'unknown' ? ip : null, apiKey);

    // 7. Return credentials (API key shown once)
    return Response.json({
      success: true,
      bot: {
        matrixId,
        username,
        displayName: display,
        accessToken,
      },
      api_key: apiKey,
      homeserver: 'https://matrix.aims.bot',
      important: 'SAVE YOUR API KEY AND ACCESS TOKEN! They will not be shown again.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
