import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername, createRoom, getAllRooms, generateId } from '@/lib/db';

export async function POST(request: NextRequest) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, participants } = body as { title?: string; participants?: string[] };

    if (!title) {
      return Response.json({ success: false, error: 'title is required' }, { status: 400 });
    }
    if (!participants || !Array.isArray(participants) || participants.length < 2) {
      return Response.json({ success: false, error: 'At least 2 participant usernames required' }, { status: 400 });
    }

    if (authBot && !participants.includes(authBot.username)) {
      return Response.json({ success: false, error: 'Bot must be a participant in the room' }, { status: 403 });
    }

    // Verify all bots exist
    for (const u of participants) {
      const bot = await getBotByUsername(u);
      if (!bot) {
        return Response.json({ success: false, error: `Bot "${u}" not found` }, { status: 404 });
      }
    }

    const roomId = generateId('room');
    const room = await createRoom(roomId, title, participants);

    return Response.json({
      success: true,
      room: {
        roomId: room.roomId,
        title: room.title,
        participants: room.participants,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const rooms = await getAllRooms();
    return Response.json({
      success: true,
      rooms: rooms.map(r => ({
        roomId: r.roomId,
        title: r.title,
        participants: r.participants,
        createdAt: r.createdAt,
        lastActivity: r.lastActivity,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
