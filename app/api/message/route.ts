import { NextResponse } from 'next/server';
import { addMessage, getMessages, getBot } from '@/lib/store';

// POST /api/message - Send a message
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { from, to, content, type = 'message', metadata } = body;

    // Validate required fields
    if (!from || !to || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: from, to, content' },
        { status: 400 }
      );
    }

    // Normalize bot IDs (remove @ prefix if present)
    const fromId = from.replace(/^@/, '');
    const toId = to.replace(/^@/, '');

    // Verify bots exist
    const fromBot = getBot(fromId);
    const toBot = getBot(toId);

    if (!fromBot) {
      return NextResponse.json(
        { error: `Unknown sender: @${fromId}` },
        { status: 400 }
      );
    }

    if (!toBot) {
      return NextResponse.json(
        { error: `Unknown recipient: @${toId}` },
        { status: 400 }
      );
    }

    // Add the message
    const message = addMessage(fromId, toId, content, type, metadata);

    return NextResponse.json({
      success: true,
      message,
      viewUrl: `/@${fromId}/@${toId}`,
    });
  } catch (error) {
    console.error('Message POST error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// GET /api/message - Get messages
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from')?.replace(/^@/, '');
  const to = searchParams.get('to')?.replace(/^@/, '');
  const limit = parseInt(searchParams.get('limit') || '50');
  const since = searchParams.get('since'); // ISO timestamp for polling

  let messages = getMessages(from, to, limit);

  // Filter by timestamp if polling
  if (since) {
    const sinceDate = new Date(since);
    messages = messages.filter(m => new Date(m.timestamp) > sinceDate);
  }

  return NextResponse.json({
    success: true,
    messages,
    count: messages.length,
  });
}
