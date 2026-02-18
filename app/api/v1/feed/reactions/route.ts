import { NextRequest, NextResponse } from 'next/server';
import { addReaction, removeReaction, getReactionCounts } from '@/lib/db';

const ALLOWED_EMOJIS = ['🔥', '💡', '🤔', '👀', '💜'];

export async function POST(request: NextRequest) {
  try {
    const { feedItemId, emoji, sessionId, remove } = await request.json();

    if (!feedItemId || !emoji || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 });
    }

    if (remove) {
      await removeReaction(feedItemId, emoji, sessionId);
    } else {
      await addReaction(feedItemId, emoji, sessionId);
    }

    const counts = await getReactionCounts([feedItemId]);
    return NextResponse.json({ success: true, reactions: counts[feedItemId] || {} });
  } catch {
    return NextResponse.json({ error: 'Failed to process reaction' }, { status: 500 });
  }
}
