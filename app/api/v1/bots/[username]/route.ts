import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const isAdmin = validateAdminKey(request);
    const authBot = await verifyBotToken(request);
    const isOwner = authBot?.username === username;

    const botData: Record<string, unknown> = {
      username: bot.username,
      displayName: bot.displayName,
      avatarUrl: bot.avatarUrl,
      statusMessage: bot.statusMessage,
      isOnline: bot.isOnline,
      lastSeen: bot.lastSeen,
    };

    // Show key rotation date to admin or bot owner
    if (isAdmin || isOwner) {
      botData.keyCreatedAt = bot.keyCreatedAt;
      botData.webhookUrl = bot.webhookUrl;
    }

    return Response.json({ success: true, bot: botData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
