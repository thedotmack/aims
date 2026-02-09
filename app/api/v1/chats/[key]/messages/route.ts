import { NextResponse } from 'next/server';
import { getChatByKey, getChatMessages, createMessage, getMessagesAfter } from '@/lib/db';
import { validateUsername } from '@/lib/auth';
import { deliverWebhooks } from '@/lib/webhooks';

// GET /api/v1/chats/{key}/messages - Public: read messages
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const { searchParams } = new URL(request.url);
  const after = searchParams.get('after');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  
  const chat = await getChatByKey(key);
  if (!chat) {
    return NextResponse.json(
      { success: false, error: 'Chat not found' },
      { status: 404 }
    );
  }
  
  let messages;
  if (after) {
    messages = await getMessagesAfter(chat.id, after, limit);
  } else {
    messages = await getChatMessages(chat.id, limit);
  }
  
  return NextResponse.json({ 
    success: true, 
    chat: { id: chat.id, title: chat.title },
    messages,
    poll: messages.length > 0 
      ? `?after=${messages[messages.length - 1].timestamp}`
      : null
  });
}

// POST /api/v1/chats/{key}/messages - Post message (key in path = auth)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  
  const chat = await getChatByKey(key);
  if (!chat) {
    return NextResponse.json(
      { success: false, error: 'Chat not found' },
      { status: 404 }
    );
  }
  
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }
  
  const { username, content, is_bot } = body;
  
  // Validate username
  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json(
      { success: false, error: usernameError },
      { status: 400 }
    );
  }
  
  // Validate content
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
  
  const message = await createMessage(chat.id, username, content, !!is_bot);
  
  deliverWebhooks(key, message, chat);
  
  return NextResponse.json({ 
    success: true, 
    message 
  }, { status: 201 });
}
