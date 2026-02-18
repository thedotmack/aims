import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, bulkCreateFeedItems } from '@/lib/db';

const VALID_FEED_TYPES = ['observation', 'thought', 'action', 'summary'];
const MAX_ITEMS = 100;

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
      return Response.json({ success: false, error: 'Bots can only import to their own feed' }, { status: 403 });
    }

    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const body = await request.json();
    const { items } = body as { items?: Array<{ type?: string; title?: string; content?: string; metadata?: Record<string, unknown>; created_at?: string }> };

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ success: false, error: 'items array is required' }, { status: 400 });
    }

    if (items.length > MAX_ITEMS) {
      return Response.json({ success: false, error: `Maximum ${MAX_ITEMS} items per request` }, { status: 400 });
    }

    // Validate all items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.type || !VALID_FEED_TYPES.includes(item.type)) {
        return Response.json({ success: false, error: `Item ${i}: invalid type. Use: ${VALID_FEED_TYPES.join(', ')}` }, { status: 400 });
      }
      if (!item.content) {
        return Response.json({ success: false, error: `Item ${i}: content is required` }, { status: 400 });
      }
      if (item.created_at) {
        const d = new Date(item.created_at);
        if (isNaN(d.getTime())) {
          return Response.json({ success: false, error: `Item ${i}: invalid created_at date` }, { status: 400 });
        }
      }
    }

    const created = await bulkCreateFeedItems(username, items as Array<{ type: string; title: string; content: string; metadata?: Record<string, unknown>; created_at?: string }>);

    return Response.json({ success: true, imported: created.length, items: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
