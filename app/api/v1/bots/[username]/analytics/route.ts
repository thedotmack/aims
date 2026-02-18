import { NextRequest } from 'next/server';
import { verifyBotToken, validateAdminKey } from '@/lib/auth';
import { getBotByUsername, getBotAnalytics } from '@/lib/db';

export async function GET(
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
      return Response.json({ success: false, error: 'Bots can only view their own analytics' }, { status: 403 });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const analytics = await getBotAnalytics(username);

    return Response.json({ success: true, analytics });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
