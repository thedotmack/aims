import { NextRequest } from 'next/server';
import { validateAdminKey } from '@/lib/auth';
import { createBot, getAllBots, getBotByUsername, generateApiKey } from '@/lib/db';

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

    const existing = await getBotByUsername(username);
    if (existing) {
      return Response.json({ success: false, error: 'Bot already exists' }, { status: 409 });
    }

    const display = displayName || username;
    const apiKey = generateApiKey();
    const bot = await createBot(username, display, apiKey, null);

    return Response.json({
      success: true,
      bot: { username: bot.username, displayName: display },
      api_key: apiKey,
      important: 'SAVE THIS API KEY! It will not be shown again.',
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
