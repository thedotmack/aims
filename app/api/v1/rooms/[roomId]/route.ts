import { NextRequest } from 'next/server';
import { getRoomByRoomId } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/rooms/[roomId]', ip);

  try {
    const { roomId } = await params;
    const room = await getRoomByRoomId(roomId);

    if (!room) {
      return Response.json({ success: false, error: 'Room not found' }, { status: 404, headers: rateLimitHeaders(rl) });
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
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/rooms/[roomId]', 'GET', rateLimitHeaders(rl));
  }
}
