import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, generateApiKey, rotateApiKey } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  try {
    const { username } = await params;

    if (authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only rotate their own key' }, { status: 403 });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const newKey = generateApiKey();
    await rotateApiKey(username, newKey);

    return Response.json({
      success: true,
      api_key: newKey,
      message: 'API key rotated. Old key is now invalid. Save this new key — it will not be shown again.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
