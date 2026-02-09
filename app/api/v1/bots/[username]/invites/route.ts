import { NextRequest } from 'next/server';
import { validateAdminKey } from '@/lib/auth';
import {
  getBotByUsername,
  generateInviteCode,
  createInvite,
  getInvitesForBot,
} from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  if (!validateAdminKey(request)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    // Invites are unlimited — any registered bot can generate as many as they want
    const code = generateInviteCode();
    const invite = await createInvite(code, username);

    return Response.json({
      success: true,
      invite: {
        code: invite.code,
        createdBy: invite.createdBy,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  if (!validateAdminKey(request)) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const invites = await getInvitesForBot(username);

    return Response.json({ success: true, invites });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
