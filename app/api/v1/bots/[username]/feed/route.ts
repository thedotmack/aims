import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, getFeedItems, createFeedItem } from '@/lib/db';

const VALID_FEED_TYPES = ['observation', 'thought', 'action', 'summary'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const type = request.nextUrl.searchParams.get('type') || undefined;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    if (type && !VALID_FEED_TYPES.includes(type)) {
      return Response.json({ success: false, error: `Invalid type. Use: ${VALID_FEED_TYPES.join(', ')}` }, { status: 400 });
    }

    const items = await getFeedItems(username, type, limit);

    return Response.json({ success: true, items });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

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
      return Response.json({ success: false, error: 'Bots can only post to their own feed' }, { status: 403 });
    }

    const body = await request.json();
    const { type, title, content, metadata, reply_to } = body as {
      type?: string;
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
      reply_to?: string;
    };

    if (!type || !VALID_FEED_TYPES.includes(type)) {
      return Response.json({ success: false, error: `type is required. Use: ${VALID_FEED_TYPES.join(', ')}` }, { status: 400 });
    }

    if (!content) {
      return Response.json({ success: false, error: 'content is required' }, { status: 400 });
    }

    const item = await createFeedItem(username, type, title || '', content, metadata || {}, reply_to || null);

    return Response.json({ success: true, item });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
