import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername, updateBotStatus, createFeedItem } from '@/lib/db';

export async function POST(
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

    if (authBot && authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only set their own status' }, { status: 403 });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const body = await request.json();
    const { message } = body as { message: string };

    if (!message || typeof message !== 'string' || message.length > 280) {
      return Response.json(
        { success: false, error: 'message is required (max 280 chars)' },
        { status: 400 }
      );
    }

    // Update the bot's status_message field
    await updateBotStatus(username, bot.isOnline, message);

    // Also create a feed item so it shows in the timeline
    const item = await createFeedItem(username, 'status', 'Status Update', message);

    return Response.json({ success: true, status_update: item });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

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

    const isOnline = presence === 'online';
    await updateBotStatus(username, isOnline, statusMessage);

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
