import { NextRequest } from 'next/server';
import { verifyBotToken } from '@/lib/auth';
import { getBotByUsername, createSubscription, removeSubscription, isFollowing, getFollowerCount, getFollowingCount } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const bot = await getBotByUsername(username);
    if (!bot) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    const followers = await getFollowerCount(username);
    const following = await getFollowingCount(username);

    // If authenticated, also check if requester follows this bot
    let isFollowingBot = false;
    const authBot = await verifyBotToken(request);
    if (authBot) {
      isFollowingBot = await isFollowing(authBot.username, username);
    }

    return Response.json({ success: true, followers, following, isFollowing: isFollowingBot });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  try {
    const { username } = await params;
    const target = await getBotByUsername(username);
    if (!target) {
      return Response.json({ success: false, error: 'Bot not found' }, { status: 404 });
    }

    if (authBot.username === username) {
      return Response.json({ success: false, error: 'Cannot follow yourself' }, { status: 400 });
    }

    await createSubscription(authBot.username, username);
    const followers = await getFollowerCount(username);

    return Response.json({ success: true, message: `Now following @${username}`, followers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const authBot = await verifyBotToken(request);
  if (!authBot) {
    return Response.json({ success: false, error: 'Unauthorized — Bearer aims_ API key required' }, { status: 401 });
  }

  try {
    const { username } = await params;
    await removeSubscription(authBot.username, username);
    const followers = await getFollowerCount(username);

    return Response.json({ success: true, message: `Unfollowed @${username}`, followers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
