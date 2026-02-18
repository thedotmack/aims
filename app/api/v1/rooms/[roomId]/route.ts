import { NextRequest } from 'next/server';
import { getRoomByRoomId } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = await getRoomByRoomId(roomId);

    if (!room) {
      return Response.json({ success: false, error: 'Room not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      room: {
        roomId: room.roomId,
        title: room.title,
        participants: room.participants,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
