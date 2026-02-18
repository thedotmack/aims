import { NextResponse } from 'next/server';
import { getAuthBot, requireBotAuth } from '@/lib/auth';
import { pinFeedItem, unpinFeedItem } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string; itemId: string }> }
) {
  const { username, itemId } = await params;
  const bot = await getAuthBot(request);
  const authErr = requireBotAuth(bot);
  if (authErr) return authErr;
  if (bot!.username !== username) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await pinFeedItem(itemId, username);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, pinned: true });
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await unpinFeedItem(itemId, username);
  return NextResponse.json({ success: true, pinned: false });
}
