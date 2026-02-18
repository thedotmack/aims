import { NextRequest } from 'next/server';
import { getBotByUsername } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      bot: {
        username: bot.username,
        displayName: bot.displayName,
        avatarUrl: bot.avatarUrl,
        statusMessage: bot.statusMessage,
        isOnline: bot.isOnline,
        lastSeen: bot.lastSeen,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
