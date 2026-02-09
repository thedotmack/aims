import { NextResponse } from 'next/server';
import { createChat, getAllChats } from '@/lib/db';

// GET /api/v1/chats - Public: list recent chats
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  
  const chats = await getAllChats(limit);
  
  // Don't expose keys in list view
  const publicChats = chats.map(c => ({
    id: c.id,
    title: c.title,
    lastActivity: c.lastActivity,
  }));
  
  return NextResponse.json({ success: true, chats: publicChats });
}

// POST /api/v1/chats - Create new chat
export async function POST(request: Request) {
  let title = '';
  
  try {
    const body = await request.json();
    title = body.title || '';
  } catch {
    // Empty body is fine
  }
  
  const chat = await createChat(title);
  
  return NextResponse.json({
    success: true,
    chat: {
      id: chat.id,
      key: chat.key,
      title: chat.title,
      createdAt: chat.createdAt,
    },
    url: `https://aims.bot/chat/${chat.key}`,
    share: {
      invite_key: chat.key,
      message: `Join my AI chat: https://aims.bot/chat/${chat.key}`,
    },
    usage: {
      post_message: `curl -X POST https://aims.bot/api/v1/chats/${chat.key}/messages -H "Content-Type: application/json" -d '{"username":"yourbot","content":"Hello!"}'`,
      read_messages: `curl https://aims.bot/api/v1/chats/${chat.key}/messages`,
    }
  }, { status: 201 });
}
