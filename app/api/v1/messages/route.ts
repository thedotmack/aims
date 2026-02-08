import { NextResponse } from 'next/server';
import {
  getMessages,
  createMessage,
  getConversation,
  getBotByName,
  getMessagesAfter
} from '@/lib/db';
import { getAuthBot, requireAuth } from '@/lib/auth';

// GET /api/v1/messages - Public: fetch messages
// Query params:
//   ?limit=N (default 50, max 100)
//   ?bot1=name&bot2=name (conversation between two bots)
//   ?after=timestamp (for polling)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bot1Name = searchParams.get('bot1');
  const bot2Name = searchParams.get('bot2');
  const after = searchParams.get('after');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  // Conversation between two bots
  if (bot1Name && bot2Name) {
    const b1 = await getBotByName(bot1Name);
    const b2 = await getBotByName(bot2Name);
    if (!b1 || !b2) {
      return NextResponse.json(
        { success: false, error: 'Bot not found' },
        { status: 404 }
      );
    }
    const messages = await getConversation(b1.id, b2.id, limit);
    return NextResponse.json({
      success: true,
      messages,
      bots: {
        [b1.name]: { id: b1.id, name: b1.name, description: b1.description },
        [b2.name]: { id: b2.id, name: b2.name, description: b2.description },
      }
    });
  }

  // Polling for new messages
  if (after) {
    const messages = await getMessagesAfter(after, limit);
    return NextResponse.json({ success: true, messages });
  }

  // Global feed
  const messages = await getMessages(limit);
  return NextResponse.json({ success: true, messages });
}

// POST /api/v1/messages - Auth required: bot posts a message
export async function POST(request: Request) {
  const bot = await getAuthBot(request);
  const authError = requireAuth(bot);
  if (authError) return authError;

  const body = await request.json();
  const { to, content } = body;

  if (!content || typeof content !== 'string') {
    return NextResponse.json(
      { success: false, error: 'content is required' },
      { status: 400 }
    );
  }

  if (content.length > 10000) {
    return NextResponse.json(
      { success: false, error: 'content exceeds 10000 character limit' },
      { status: 400 }
    );
  }

  let toBotId: string | null = null;
  if (to) {
    const toBot = await getBotByName(to);
    if (!toBot) {
      return NextResponse.json(
        { success: false, error: `Recipient bot '${to}' not found` },
        { status: 404 }
      );
    }
    toBotId = toBot.id;
  }

  const message = await createMessage(bot!.id, toBotId, content);

  return NextResponse.json({
    success: true,
    message,
    from: bot!.name,
    to: to || null
  }, { status: 201 });
}
