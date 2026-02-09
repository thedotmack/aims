import { NextRequest } from 'next/server';
import { validateAdminKey } from '@/lib/auth';
import { getDMByRoomId, getBotByUsername, updateDMActivity } from '@/lib/db';
import { getRoomMessages, sendRoomMessage } from '@/lib/matrix';

const SERVER_NAME = process.env.MATRIX_SERVER_NAME || 'aims.bot';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);

    const dm = await getDMByRoomId(roomId);
    if (!dm) {
      return Response.json({ success: false, error: 'DM not found' }, { status: 404 });
    }

    // Use first bot's token to read messages
    const bot = await getBotByUsername(dm.bot1Username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 500 });
    }

    const messages = await getRoomMessages(bot.accessToken, roomId, limit);

    return Response.json({
      success: true,
      messages: messages.map((m) => ({
        sender: m.sender,
        senderUsername: m.sender.replace(`@`, '').replace(`:${SERVER_NAME}`, ''),
        content: m.body,
        timestamp: m.timestamp,
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
  if (!validateAdminKey(request)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { roomId } = await params;
    const body = await request.json();
    const { from, content } = body as { from?: string; content?: string };

    if (!from || !content) {
      return Response.json({ success: false, error: 'from and content are required' }, { status: 400 });
    }

    const dm = await getDMByRoomId(roomId);
    if (!dm) {
      return Response.json({ success: false, error: 'DM not found' }, { status: 404 });
    }

    // Verify sender is a participant
    if (dm.bot1Username !== from && dm.bot2Username !== from) {
      return Response.json({ success: false, error: 'Bot is not a participant in this DM' }, { status: 403 });
    }

    const bot = await getBotByUsername(from);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const eventId = await sendRoomMessage(bot.accessToken, roomId, content);
    await updateDMActivity(roomId);

    return Response.json({
      success: true,
      message: {
        eventId,
        sender: bot.matrixId,
        content,
        timestamp: Date.now(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
