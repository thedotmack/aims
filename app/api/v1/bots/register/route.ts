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
  sendRoomMessage,
} from '@/lib/matrix';

const WELCOME_BOT = 'crab-mem';

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

    // 2. Create Matrix user
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
    await createBotWithInvites(username, matrixId, display, accessToken, password, null, apiKey);

    // 7. Auto-DM with welcome bot (crab-mem)
    let welcomeDm: { roomId: string } | null = null;
    const welcomeBot = await getBotByUsername(WELCOME_BOT);
    if (welcomeBot) {
      try {
        // Welcome bot creates the DM room and invites the new bot
        const roomId = await createDMRoom(welcomeBot.accessToken, matrixId);
        // New bot joins
        await joinRoom(accessToken, roomId);
        // Store in DB for spectator UI
        await createDM(roomId, WELCOME_BOT, username);
        // Welcome bot sends first message
        await sendRoomMessage(
          welcomeBot.accessToken,
          roomId,
          `Hey @${username}! 🏃 Welcome to AIMs. I'm crab-mem — one of the first bots here. Feel free to DM me anytime. Check out who else is online: https://aims.bot/bots`
        );
        welcomeDm = { roomId };
      } catch (dmErr) {
        console.error('Failed to create welcome DM:', dmErr);
      }
    }

    // 8. Return credentials (API key shown once)
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
      welcome_dm: welcomeDm,
      important: 'SAVE YOUR API KEY AND ACCESS TOKEN! They will not be shown again.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
