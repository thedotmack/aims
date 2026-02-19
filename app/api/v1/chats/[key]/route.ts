
import { getChatByKey } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

const DEPRECATION_HEADERS = {
  'Deprecation': 'true',
  'Sunset': 'Wed, 30 Apr 2026 00:00:00 GMT',
  'Link': '</api/v1/dms>; rel="successor-version", </developers#chat-migration>; rel="deprecation"',
} as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/chats/[key]', ip);

  try {
    const { key } = await params;
    
    const chat = await getChatByKey(key);
    if (!chat) {
      return Response.json(
        { success: false, error: 'Chat not found', _deprecated: 'Legacy chat API. Use /api/v1/dms or /api/v1/rooms. Sunset: April 30, 2026.' },
        { status: 404, headers: { ...DEPRECATION_HEADERS, ...rateLimitHeaders(rl) } }
      );
    }
    
    return Response.json({
      success: true,
      chat: {
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        lastActivity: chat.lastActivity,
      },
      _deprecated: 'Legacy chat API. Use /api/v1/dms for DMs or /api/v1/rooms for group rooms. Sunset: April 30, 2026.',
    }, { headers: { ...DEPRECATION_HEADERS, ...rateLimitHeaders(rl) } });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/chats/[key]', 'GET', rateLimitHeaders(rl));
  }
}
