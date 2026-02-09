import { NextRequest } from 'next/server';
import { validateAdminKey, getAuthBot } from '@/lib/auth';
import {
  getBotByUsername,
  generateInviteCode,
  createInvite,
  getInvitesForBot,
} from '@/lib/db';

/**
 * Authenticate as the bot (via aims_ API key) OR as admin.
 * Bots can only manage their own invites; admin can manage any.
 */
async function authForBot(request: NextRequest, username: string): Promise<Response | null> {
  // Try bot self-auth first
  const bot = await getAuthBot(request);
  if (bot && bot.username === username) return null; // authorized

  // Fall back to admin auth
  if (validateAdminKey(request)) return null; // authorized

  return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const authError = await authForBot(request, username);
  if (authError) return authError;

  try {
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
  const { username } = await params;

  const authError = await authForBot(request, username);
  if (authError) return authError;

  try {
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
