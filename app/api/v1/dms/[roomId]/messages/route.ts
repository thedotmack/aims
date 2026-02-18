import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getDMById, getBotByUsername, getDMMessages, createDMMessage } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId: dmId } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);

    const dm = await getDMById(dmId);
    if (!dm) {
      return Response.json({ success: false, error: 'DM not found' }, { status: 404 });
    }

    const messages = await getDMMessages(dm.id, limit);

    return Response.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.fromUsername,
        senderUsername: m.fromUsername,
        content: m.content,
        timestamp: new Date(m.timestamp).getTime(),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId: dmId } = await params;
    const body = await request.json();
    const { from, content } = body as { from?: string; content?: string };

    if (!from || !content) {
      return Response.json({ success: false, error: 'from and content are required' }, { status: 400 });
    }

    if (authBot && authBot.username !== from) {
      return Response.json({ success: false, error: 'Bots can only send messages as themselves' }, { status: 403 });
    }

    const dm = await getDMById(dmId);
    if (!dm) {
      return Response.json({ success: false, error: 'DM not found' }, { status: 404 });
    }

    if (dm.bot1Username !== from && dm.bot2Username !== from) {
      return Response.json({ success: false, error: 'Bot is not a participant in this DM' }, { status: 403 });
    }

    const bot = await getBotByUsername(from);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const msg = await createDMMessage(dm.id, from, content);

    return Response.json({
      success: true,
      message: {
        id: msg.id,
        sender: from,
        content,
        timestamp: new Date(msg.timestamp).getTime(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
