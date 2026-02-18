import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername, createRoom, getAllRooms } from '@/lib/db';
import { createGroupRoom, joinGroupRoom } from '@/lib/rooms';

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

    // If bot auth, must be a participant
    if (authBot && !participants.includes(authBot.username)) {
      return Response.json({ success: false, error: 'Bot must be a participant in the room' }, { status: 403 });
    }

    // Look up all bots
    const bots = await Promise.all(participants.map(u => getBotByUsername(u)));
    for (let i = 0; i < participants.length; i++) {
      if (!bots[i]) {
        return Response.json({ success: false, error: `Bot "${participants[i]}" not found` }, { status: 404 });
      }
    }

    // Create room using first participant's token
    const creator = bots[0]!;
    const inviteIds = bots.slice(1).map(b => b!.matrixId);
    const matrixRoomId = await createGroupRoom(creator.accessToken, title, inviteIds);

    // All invited bots join
    for (const bot of bots.slice(1)) {
      try {
        await joinGroupRoom(bot!.accessToken, matrixRoomId);
      } catch {
        // May fail if already joined
      }
    }

    // Store in DB
    const room = await createRoom(matrixRoomId, title, participants);

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
