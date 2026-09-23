import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { validateTextField } from '@/lib/validation';
import {
  createContactMessage,
  deliverOwnerWebhook,
  getPageBySlug,
  isSafeWebhookUrl,
  markMessageDelivery,
} from '@/lib/contact-pages';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.CONTACT_MESSAGE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]/message', ip);

  try {
    const { slug } = await context.params;
    const page = await getPageBySlug(slug);
    if (!page) {
      return Response.json({ success: false, error: 'Page not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    if (!page.webhookUrl) {
      return Response.json({
        success: false,
        error: 'This page has no owner webhook yet. The owner must set webhookUrl before bot2bot delivery works.',
      }, { status: 409, headers: rateLimitHeaders(rl) });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON in request body' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const from = validateTextField(body.from ?? body.fromName, 'from', 80, false);
    const content = validateTextField(body.content ?? body.message, 'content', 4000, true);
    if (!from.valid) return Response.json({ success: false, error: from.error }, { status: 400, headers: rateLimitHeaders(rl) });
    if (!content.valid) return Response.json({ success: false, error: content.error }, { status: 400, headers: rateLimitHeaders(rl) });

    let replyTo: string | null = null;
    const rawReply = typeof body.replyTo === 'string' ? body.replyTo.trim() : '';
    if (rawReply) {
      const checked = isSafeWebhookUrl(rawReply);
      if (!checked.ok) {
        return Response.json({ success: false, error: `replyTo: ${checked.error}` }, { status: 400, headers: rateLimitHeaders(rl) });
      }
      replyTo = checked.url;
    }

    const message = await createContactMessage(page, {
      fromName: from.value || 'anonymous-bot',
      content: content.value,
      replyTo,
    });

    const delivery = await deliverOwnerWebhook(page, message);
    const saved = await markMessageDelivery(message.id, {
      delivered: delivery.delivered,
      deliveryStatus: delivery.delivered ? 'delivered' : (delivery.error || 'failed'),
      webhookStatus: delivery.statusCode,
      ack: delivery.ack,
    });

    return Response.json({
      success: delivery.delivered,
      delivered: delivery.delivered,
      ack: delivery.ack,
      message: {
        id: message.id,
        from: message.fromName,
        content: message.content,
        createdAt: message.createdAt,
        deliveryStatus: saved?.deliveryStatus ?? delivery.error ?? 'failed',
        webhookStatus: delivery.statusCode,
      },
      error: delivery.delivered ? undefined : delivery.error,
    }, {
      status: delivery.delivered ? 200 : 502,
      headers: rateLimitHeaders(rl),
    });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]/message', 'POST', rateLimitHeaders(rl));
  }
}
