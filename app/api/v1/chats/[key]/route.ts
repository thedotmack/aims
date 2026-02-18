
import { getChatByKey } from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/chats/[key]', ip);

  try {
    const { key } = await params;
    
    const chat = await getChatByKey(key);
    if (!chat) {
      return Response.json(
        { success: false, error: 'Chat not found' },
        { status: 404, headers: rateLimitHeaders(rl) }
      );
    }
    
    return Response.json({
      success: true,
      chat: {
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        lastActivity: chat.lastActivity,
      }
    }, { headers: rateLimitHeaders(rl) });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/chats/[key]', 'GET', rateLimitHeaders(rl));
  }
}
