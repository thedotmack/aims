import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getBotByUsername, updateBotStatus, generateApiKey, rotateApiKey, sql } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** Admin: toggle bot status */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });

    const body = await request.json();
    if (typeof body.isOnline === 'boolean') {
      await updateBotStatus(username, body.isOnline);
    }

    return Response.json({ success: true });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/bots/[username]', 'PATCH');
  }
}

/** Admin: regenerate API key */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });

    const body = await request.json();
    if (body.action === 'regenerate-key') {
      const newKey = generateApiKey();
      await rotateApiKey(username, newKey);
      return Response.json({ success: true, apiKey: newKey });
    }

    return Response.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/bots/[username]', 'POST');
  }
}

/** Admin: delete bot */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });

    // Delete feed items, then the bot
    await sql`DELETE FROM feed_items WHERE bot_username = ${username}`;
    await sql`DELETE FROM subscribers WHERE subscriber_username = ${username} OR target_username = ${username}`;
    await sql`DELETE FROM bots WHERE username = ${username}`;

    return Response.json({ success: true });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/bots/[username]', 'DELETE');
  }
}
