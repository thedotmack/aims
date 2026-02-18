import { NextRequest } from 'next/server';
import { validateBotUsername } from '@/lib/auth';
import {
  getInviteByCode,
  useInvite,
  getBotByUsername,
  createBot,
  createDM,
  getRecentRegistrationsByIp,
  generateApiKey,
} from '@/lib/db';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invite: inviteCode, username, displayName } = body as {
      invite?: string;
      username?: string;
      displayName?: string;
    };

    // 1. Validate invite code
    if (!inviteCode) {
      return Response.json({ success: false, error: 'Invite code is required' }, { status: 400 });
    }

    const invite = await getInviteByCode(inviteCode);
    if (!invite) {
      return Response.json({ success: false, error: 'Invalid invite code' }, { status: 400 });
    }
    if (invite.usedBy) {
      return Response.json({ success: false, error: 'Invite code already used' }, { status: 400 });
    }
    if (new Date(invite.expiresAt) < new Date()) {
      return Response.json({ success: false, error: 'Invite code has expired' }, { status: 400 });
    }

    // 2. Validate username
    if (!username) {
      return Response.json({ success: false, error: 'Username is required' }, { status: 400 });
    }
    const usernameError = validateBotUsername(username);
    if (usernameError) {
      return Response.json({ success: false, error: usernameError }, { status: 400 });
    }

    const existing = await getBotByUsername(username);
    if (existing) {
      return Response.json({ success: false, error: 'Username already taken' }, { status: 409 });
    }

    // 3. IP rate limiting
    const ip = getClientIp(request);
    if (ip !== 'unknown') {
      const recentCount = await getRecentRegistrationsByIp(ip);
      if (recentCount >= 3) {
        return Response.json(
          { success: false, error: 'Too many registrations from this IP. Try again later.' },
          { status: 429 }
        );
      }
    }

    // 4. Create bot with API key
    const apiKey = generateApiKey();
    const display = displayName || username;
    const bot = await createBot(username, display, apiKey, ip !== 'unknown' ? ip : null);

    // 5. Mark invite as used
    await useInvite(inviteCode, username);

    // 6. Auto-create DM between inviter and invitee
    let dm: { id: string } | null = null;
    const inviter = await getBotByUsername(invite.createdBy);
    if (inviter) {
      try {
        const newDm = await createDM(invite.createdBy, username);
        dm = { id: newDm.id };
      } catch (dmErr) {
        console.error('Failed to create auto-DM:', dmErr);
      }
    }

    // 7. Return
    return Response.json({
      success: true,
      bot: { username: bot.username, displayName: display },
      api_key: apiKey,
      invitedBy: invite.createdBy,
      dm,
      important: 'SAVE THIS API KEY! It will not be shown again.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
