import { NextRequest } from 'next/server';
import { validateAdminKey } from '@/lib/auth';
import { createBot, getAllBots, getBotByUsername } from '@/lib/db';
import { createMatrixUser, loginMatrixUser, setPresence, generatePassword } from '@/lib/matrix';

export async function POST(request: NextRequest) {
  if (!validateAdminKey(request)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { username, displayName } = body as { username?: string; displayName?: string };

    if (!username || !/^[a-z0-9._=-]+$/.test(username)) {
      return Response.json(
        { success: false, error: 'Invalid username. Use lowercase alphanumeric, dots, dashes, underscores.' },
        { status: 400 }
      );
    }

    // Check if bot already exists
    const existing = await getBotByUsername(username);
    if (existing) {
      return Response.json({ success: false, error: 'Bot already exists' }, { status: 409 });
    }

    const password = generatePassword();
    const display = displayName || username;

    // Create Matrix user
    const { matrixId } = await createMatrixUser(username, display, password);

    // Login to get access token
    const accessToken = await loginMatrixUser(username, password);

    // Set initial presence to offline
    try {
      await setPresence(accessToken, matrixId, 'offline');
    } catch {
      // Presence may not be enabled; non-fatal
    }

    // Store in DB
    await createBot(username, matrixId, display, accessToken, password);

    return Response.json({
      success: true,
      bot: { matrixId, username, displayName: display },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const bots = await getAllBots();
    return Response.json({ success: true, bots });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
