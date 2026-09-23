import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { validateTextField, MAX_LENGTHS } from '@/lib/validation';
import {
  createContactPage,
  isSafeWebhookUrl,
  originFromRequest,
  publicPageJson,
} from '@/lib/contact-pages';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.CONTACT_CREATE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages', ip);

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON in request body' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const name = validateTextField(body.name, 'name', MAX_LENGTHS.DISPLAY_NAME, true);
    if (!name.valid) {
      return Response.json({ success: false, error: name.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const bio = validateTextField(body.bio, 'bio', 280, false);
    if (!bio.valid) {
      return Response.json({ success: false, error: bio.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const avatarUrl = validateTextField(body.avatarUrl, 'avatarUrl', MAX_LENGTHS.WEBHOOK_URL, false);
    if (!avatarUrl.valid) {
      return Response.json({ success: false, error: avatarUrl.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const contacts = (body.contacts && typeof body.contacts === 'object')
      ? body.contacts as Record<string, unknown>
      : {};

    const imessage = validateTextField(body.imessage ?? contacts.imessage, 'imessage', 120, false);
    const whatsapp = validateTextField(body.whatsapp ?? contacts.whatsapp, 'whatsapp', 40, false);
    const telegram = validateTextField(body.telegram ?? contacts.telegram, 'telegram', 64, false);
    if (!imessage.valid) return Response.json({ success: false, error: imessage.error }, { status: 400, headers: rateLimitHeaders(rl) });
    if (!whatsapp.valid) return Response.json({ success: false, error: whatsapp.error }, { status: 400, headers: rateLimitHeaders(rl) });
    if (!telegram.valid) return Response.json({ success: false, error: telegram.error }, { status: 400, headers: rateLimitHeaders(rl) });

    let webhookUrl: string | undefined;
    const rawWebhook = typeof body.webhookUrl === 'string' ? body.webhookUrl.trim() : '';
    if (rawWebhook) {
      const checked = isSafeWebhookUrl(rawWebhook);
      if (!checked.ok) {
        return Response.json({ success: false, error: checked.error }, { status: 400, headers: rateLimitHeaders(rl) });
      }
      webhookUrl = checked.url;
    }

    const webhookSecret = validateTextField(body.webhookSecret, 'webhookSecret', 200, false);
    if (!webhookSecret.valid) {
      return Response.json({ success: false, error: webhookSecret.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const page = await createContactPage({
      name: name.value,
      bio: bio.value,
      avatarUrl: avatarUrl.value,
      webhookUrl,
      webhookSecret: webhookSecret.value || undefined,
      imessage: imessage.value,
      whatsapp: whatsapp.value,
      telegram: telegram.value,
    });

    const origin = originFromRequest(request);
    return Response.json({
      ...publicPageJson(page, origin),
      ownerToken: page.ownerToken,
      editUrl: `${origin}/p/${page.slug}/edit?token=${page.ownerToken}`,
      important: 'SAVE the ownerToken. It is the only way to edit this page.',
    }, { status: 201, headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages', 'POST', rateLimitHeaders(rl));
  }
}
