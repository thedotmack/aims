import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { createInbox, originFromRequest } from '@/lib/contact-pages';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.CONTACT_CREATE, `inbox:${ip}`);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/inbox', ip);

  try {
    const inbox = await createInbox(originFromRequest(request));
    return Response.json({
      success: true,
      token: inbox.token,
      url: inbox.url,
      note: 'POST JSON to url to capture a webhook. GET the same url to read captured payloads.',
    }, { status: 201, headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/inbox', 'POST', rateLimitHeaders(rl));
  }
}
