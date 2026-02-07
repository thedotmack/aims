import { NextResponse } from 'next/server';
import { getChatByKey } from '@/lib/db';

// GET /api/v1/chats/{key} - Get chat info
export async function GET(
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
  
  return NextResponse.json({
    success: true,
    chat: {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      lastActivity: chat.lastActivity,
    }
  });
}
