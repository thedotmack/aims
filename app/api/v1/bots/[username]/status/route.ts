import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername, updateBotStatus } from '@/lib/db';
import { setPresence } from '@/lib/matrix';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username } = await params;

    // Bot self-auth: can only set own status
    if (authBot && authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only set their own status' }, { status: 403 });
    }

    const body = await request.json();
    const { presence, statusMessage } = body as {
      presence: 'online' | 'offline' | 'unavailable';
      statusMessage?: string;
    };

    if (!['online', 'offline', 'unavailable'].includes(presence)) {
      return Response.json(
        { success: false, error: 'Invalid presence. Use: online, offline, unavailable' },
        { status: 400 }
      );
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    // Update Matrix presence
    await setPresence(bot.accessToken, bot.matrixId, presence, statusMessage);

    // Update DB
    const isOnline = presence === 'online';
    await updateBotStatus(username, isOnline, statusMessage);

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
