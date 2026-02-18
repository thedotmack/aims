import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, updateBotWebhookUrl } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username } = await params;

    if (authBot.username !== username) {
      return Response.json({ success: false, error: 'Bots can only manage their own webhook' }, { status: 403 });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const body = await request.json();
    const { webhook_url } = body as { webhook_url?: string };

    if (webhook_url !== undefined && webhook_url !== null && webhook_url !== '') {
      try {
        new URL(webhook_url);
      } catch {
        return Response.json({ success: false, error: 'Invalid URL' }, { status: 400 });
      }
    }

    await updateBotWebhookUrl(username, webhook_url || null);

    return Response.json({ success: true, webhook_url: webhook_url || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { username } = await params;

  if (authBot.username !== username) {
    return Response.json({ success: false, error: 'Bots can only view their own webhook' }, { status: 403 });
  }

  const bot = await getBotByUsername(username);
  if (!bot) {
    return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
  }

  return Response.json({ success: true, webhook_url: bot.webhookUrl });
}
