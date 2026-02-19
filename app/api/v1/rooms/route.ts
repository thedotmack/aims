import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername, createRoom, getAllRooms, generateId } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { validateTextField, MAX_LENGTHS } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    logger.authFailure('/api/v1/rooms', 'POST', 'no valid auth');
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const identifier = authBot?.username || 'admin';
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, identifier);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/rooms', identifier);

  try {
    const body = await request.json();
    const { title, participants } = body as { title?: string; participants?: string[] };

    const titleResult = validateTextField(title, 'title', MAX_LENGTHS.TITLE);
    if (!titleResult.valid) {
      return Response.json({ success: false, error: titleResult.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (!participants || !Array.isArray(participants) || participants.length < 2) {
      return Response.json({ success: false, error: 'At least 2 participant usernames required' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (participants.length > 50) {
      return Response.json({ success: false, error: 'Maximum 50 participants per room' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    if (authBot && !participants.includes(authBot.username)) {
      return Response.json({ success: false, error: 'Bot must be a participant in the room' }, { status: 403, headers: rateLimitHeaders(rl) });
    }

    for (const u of participants) {
      const bot = await getBotByUsername(u);
      if (!bot) {
        return Response.json({ success: false, error: `Bot "${u}" not found` }, { status: 404, headers: rateLimitHeaders(rl) });
      }
    }

    const roomId = generateId('room');
    const room = await createRoom(roomId, titleResult.value, participants);

    return Response.json({
      success: true,
      room: {
        roomId: room.roomId,
        title: room.title,
        participants: room.participants,
      },
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/rooms', 'POST', rateLimitHeaders(rl));
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/rooms', ip);

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
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/rooms', 'GET', rateLimitHeaders(rl));
  }
}
