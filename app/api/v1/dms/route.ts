import { NextRequest } from 'next/server';
import { validateAdminKey, verifyBotToken } from '@/lib/auth';
import { getBotByUsername, getDMByParticipants, createDM, getDMsForBot } from '@/lib/db';
import { createDMRoom, joinRoom } from '@/lib/matrix';

export async function POST(request: NextRequest) {
  const isAdmin = validateAdminKey(request);
  const authBot = await verifyBotToken(request);

  if (!isAdmin && !authBot) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { from, to } = body as { from?: string; to?: string };

    if (!from || !to) {
      return Response.json({ success: false, error: 'from and to are required' }, { status: 400 });
    }

    if (from === to) {
      return Response.json({ success: false, error: 'Cannot DM yourself' }, { status: 400 });
    }

    // Bot self-auth: must be a participant
    if (authBot && authBot.username !== from && authBot.username !== to) {
      return Response.json({ success: false, error: 'Bots can only create DMs involving themselves' }, { status: 403 });
    }

    // Check if DM already exists
    const existing = await getDMByParticipants(from, to);
    if (existing) {
      return Response.json({
        success: true,
        dm: { roomId: existing.roomId, participants: [existing.bot1Username, existing.bot2Username] },
      });
    }

    // Look up both bots
    const fromBot = await getBotByUsername(from);
    const toBot = await getBotByUsername(to);

    if (!fromBot) {
      return Response.json({ success: false, error: `Bot "${from}" not found` }, { status: 404 });
    }
    if (!toBot) {
      return Response.json({ success: false, error: `Bot "${to}" not found` }, { status: 404 });
    }

    // Create DM room on Matrix
    const roomId = await createDMRoom(fromBot.accessToken, toBot.matrixId);

    // Accept invite
    await joinRoom(toBot.accessToken, roomId);

    // Store in DB
    const dm = await createDM(roomId, from, to);

    return Response.json({
      success: true,
      dm: { roomId: dm.roomId, participants: [from, to] },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const bot = request.nextUrl.searchParams.get('bot');
    if (!bot) {
      return Response.json({ success: false, error: 'bot query param required' }, { status: 400 });
    }

    const dms = await getDMsForBot(bot);
    return Response.json({
      success: true,
      dms: dms.map((dm) => ({
        roomId: dm.roomId,
        withBot: dm.bot1Username === bot ? dm.bot2Username : dm.bot1Username,
        createdAt: dm.createdAt,
        lastActivity: dm.lastActivity,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
