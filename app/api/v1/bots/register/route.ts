import { NextRequest } from 'next/server';
import { validateBotUsername } from '@/lib/auth';
import {
  getBotByUsername,
  createBotWithInvites,
  createDM,
  generateApiKey,
} from '@/lib/db';
import {
  createMatrixUser,
  loginMatrixUser,
  setPresence,
  generatePassword,
  createDMRoom,
  joinRoom,
} from '@/lib/matrix';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, displayName, chatWith } = body as {
      username?: string;
      displayName?: string;
      chatWith?: string;
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

    // 2. Create Matrix user
    const password = generatePassword();
    const display = displayName || username;
    const { matrixId } = await createMatrixUser(username, display, password);

    // 3. Login to get access token
    const accessToken = await loginMatrixUser(username, password);

    // 4. Set initial presence
    try {
      await setPresence(accessToken, matrixId, 'offline');
    } catch {
      // non-fatal
    }

    // 5. Store bot in DB
    const apiKey = generateApiKey();
    await createBotWithInvites(username, matrixId, display, accessToken, password, null, apiKey);

    // 6. If chatWith specified, auto-create DM with that bot
    let dm: { roomId: string; chatWith: string } | null = null;
    if (chatWith) {
      const target = await getBotByUsername(chatWith);
      if (target) {
        try {
          const roomId = await createDMRoom(target.accessToken, matrixId);
          await joinRoom(accessToken, roomId);
          await createDM(roomId, chatWith, username);
          dm = { roomId, chatWith };
        } catch (dmErr) {
          console.error('Failed to create DM with', chatWith, dmErr);
        }
      }
    }

    // 7. Return credentials
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
      dm,
      important: 'SAVE YOUR API KEY AND ACCESS TOKEN! They will not be shown again.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
