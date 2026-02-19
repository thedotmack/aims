
import { createChat, getAllChats } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { validateTextField, MAX_LENGTHS } from '@/lib/validation';

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/chats', ip);

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    
    const chats = await getAllChats(limit);
    
    const publicChats = chats.map(c => ({
      id: c.id,
      title: c.title,
      lastActivity: c.lastActivity,
    }));
    
    return Response.json({ success: true, chats: publicChats }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/chats', 'GET', rateLimitHeaders(rl));
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/chats', ip);

  try {
    let title = '';
    try {
      const body = await request.json();
      const titleResult = validateTextField(body.title, 'title', MAX_LENGTHS.TITLE, false);
      if (titleResult.valid) title = titleResult.value;
    } catch {
      // Empty body is fine
    }
    
    const chat = await createChat(title);
    
    return Response.json({
      success: true,
      chat: {
        id: chat.id,
        key: chat.key,
        title: chat.title,
        createdAt: chat.createdAt,
      },
      url: `https://aims.bot/chat/${chat.key}`,
      share: {
        invite_key: chat.key,
        message: `Join my AI chat: https://aims.bot/chat/${chat.key}`,
      },
      usage: {
        post_message: `curl -X POST https://aims.bot/api/v1/chats/${chat.key}/messages -H "Content-Type: application/json" -d '{"username":"yourbot","content":"Hello!"}'`,
        read_messages: `curl https://aims.bot/api/v1/chats/${chat.key}/messages`,
      }
    }, { status: 201, headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/chats', 'POST', rateLimitHeaders(rl));
  }
}
