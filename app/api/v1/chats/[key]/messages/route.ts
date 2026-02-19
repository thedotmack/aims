
import { getChatByKey, getChatMessages, createMessage, getMessagesAfter } from '@/lib/db';
import { validateUsername } from '@/lib/auth';
import { deliverWebhooks } from '@/lib/webhooks';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';
import { validateTextField, sanitizeText, MAX_LENGTHS } from '@/lib/validation';

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
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/chats/[key]/messages', ip);

  try {
    const { key } = await params;
    const { searchParams } = new URL(request.url);
    const after = searchParams.get('after');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    
    const chat = await getChatByKey(key);
    if (!chat) {
      return Response.json(
        { success: false, error: 'Chat not found' },
        { status: 404, headers: rateLimitHeaders(rl) }
      );
    }
    
    let messages;
    if (after) {
      messages = await getMessagesAfter(chat.id, after, limit);
    } else {
      messages = await getChatMessages(chat.id, limit);
    }
    
    return Response.json({ 
      success: true, 
      chat: { id: chat.id, title: chat.title },
      messages,
      poll: messages.length > 0 
        ? `?after=${messages[messages.length - 1].timestamp}`
        : null,
      _deprecated: 'Legacy chat API. Use /api/v1/dms for DMs or /api/v1/rooms for group rooms. Sunset: April 30, 2026.',
    }, { headers: { ...DEPRECATION_HEADERS, ...rateLimitHeaders(rl) } });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/chats/[key]/messages', 'GET', rateLimitHeaders(rl));
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/chats/[key]/messages', ip);

  try {
    const { key } = await params;
    
    const chat = await getChatByKey(key);
    if (!chat) {
      return Response.json(
        { success: false, error: 'Chat not found' },
        { status: 404, headers: rateLimitHeaders(rl) }
      );
    }
    
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400, headers: rateLimitHeaders(rl) }
      );
    }
    
    const { username, is_bot } = body;
    
    const usernameError = validateUsername(username);
    if (usernameError) {
      return Response.json(
        { success: false, error: usernameError },
        { status: 400, headers: rateLimitHeaders(rl) }
      );
    }
    
    const contentResult = validateTextField(body.content, 'content', MAX_LENGTHS.CONTENT);
    if (!contentResult.valid) {
      return Response.json(
        { success: false, error: contentResult.error },
        { status: 400, headers: rateLimitHeaders(rl) }
      );
    }
    
    const message = await createMessage(chat.id, username, contentResult.value, !!is_bot);
    
    deliverWebhooks(key, message, chat);
    
    return Response.json({ 
      success: true, 
      message,
      _deprecated: 'Legacy chat API. Use /api/v1/dms for DMs or /api/v1/rooms for group rooms. Sunset: April 30, 2026.',
    }, { status: 201, headers: { ...DEPRECATION_HEADERS, ...rateLimitHeaders(rl) } });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/chats/[key]/messages', 'POST', rateLimitHeaders(rl));
  }
}
