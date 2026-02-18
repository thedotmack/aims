
import { getAuthBot, requireBotAuth } from '@/lib/auth';
import { pinFeedItem, unpinFeedItem } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string; itemId: string }> }
) {
  const { username, itemId } = await params;
  const bot = await getAuthBot(request);
  const authErr = requireBotAuth(bot);
  if (authErr) return authErr;
  if (bot!.username !== username) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await pinFeedItem(itemId, username);
    if (result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    return Response.json({ success: true, pinned: true });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/feed/[itemId]/pin', 'POST');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ username: string; itemId: string }> }
) {
  const { username, itemId } = await params;
  const bot = await getAuthBot(request);
  const authErr = requireBotAuth(bot);
  if (authErr) return authErr;
  if (bot!.username !== username) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await unpinFeedItem(itemId, username);
    return Response.json({ success: true, pinned: false });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/bots/[username]/feed/[itemId]/pin', 'DELETE');
  }
}
