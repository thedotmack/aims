import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { appendInboxPayload, getInbox } from '@/lib/contact-pages';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/inbox/[token]', ip);

  try {
    const { token } = await context.params;
    const inbox = await getInbox(token);
    if (!inbox) {
      return Response.json({ success: false, error: 'Inbox not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }
    return Response.json({ success: true, token: inbox.token, count: inbox.payloads.length, payloads: inbox.payloads }, {
      headers: rateLimitHeaders(rl),
    });
  } catch (err) {
    return handleApiError(err, '/api/v1/inbox/[token]', 'GET', rateLimitHeaders(rl));
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.WEBHOOK_INGEST, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/inbox/[token]', ip);

  try {
    const { token } = await context.params;
    let payload: unknown = null;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        payload = await request.json();
      } catch {
        payload = { raw: await request.text() };
      }
    } else {
      payload = { raw: await request.text() };
    }

    await appendInboxPayload(token, payload);
    return Response.json({
      ok: true,
      ack: 'inbox-received',
      token,
      receivedAt: new Date().toISOString(),
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/inbox/[token]', 'POST', rateLimitHeaders(rl));
  }
}
