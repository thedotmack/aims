import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { validateTextField, MAX_LENGTHS } from '@/lib/validation';
import {
  extractOwnerToken,
  getPageBySlug,
  isSafeWebhookUrl,
  originFromRequest,
  publicPageJson,
  timingSafeEqual,
  updateContactPage,
} from '@/lib/contact-pages';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]', ip);

  try {
    const { slug } = await context.params;
    const page = await getPageBySlug(slug);
    if (!page) {
      return Response.json({ success: false, error: 'Page not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const origin = originFromRequest(request);
    const ownerToken = extractOwnerToken(request);
    const isOwner = ownerToken ? timingSafeEqual(page.ownerToken, ownerToken) : false;

    return Response.json({
      ...publicPageJson(page, origin),
      ...(isOwner ? {
        owner: true,
        webhookUrl: page.webhookUrl,
        webhookSecret: page.webhookSecret,
        imessage: page.imessage,
        whatsapp: page.whatsapp,
        telegram: page.telegram,
        editUrl: `${origin}/p/${page.slug}/edit?token=${page.ownerToken}`,
      } : {}),
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]', 'GET', rateLimitHeaders(rl));
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]', ip);

  try {
    const { slug } = await context.params;
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const ownerToken = extractOwnerToken(request, body);
    if (!ownerToken) {
      return Response.json({ success: false, error: 'Owner token required (X-Owner-Token)' }, { status: 401, headers: rateLimitHeaders(rl) });
    }

    const name = body.name === undefined ? undefined : validateTextField(body.name, 'name', MAX_LENGTHS.DISPLAY_NAME, true);
    if (name && !name.valid) return Response.json({ success: false, error: name.error }, { status: 400, headers: rateLimitHeaders(rl) });

    const bio = body.bio === undefined ? undefined : validateTextField(body.bio, 'bio', 280, false);
    if (bio && !bio.valid) return Response.json({ success: false, error: bio.error }, { status: 400, headers: rateLimitHeaders(rl) });

    const avatarUrl = body.avatarUrl === undefined ? undefined : validateTextField(body.avatarUrl, 'avatarUrl', MAX_LENGTHS.WEBHOOK_URL, false);
    if (avatarUrl && !avatarUrl.valid) return Response.json({ success: false, error: avatarUrl.error }, { status: 400, headers: rateLimitHeaders(rl) });

    const imessage = body.imessage === undefined ? undefined : validateTextField(body.imessage, 'imessage', 120, false);
    const whatsapp = body.whatsapp === undefined ? undefined : validateTextField(body.whatsapp, 'whatsapp', 40, false);
    const telegram = body.telegram === undefined ? undefined : validateTextField(body.telegram, 'telegram', 64, false);
    if (imessage && !imessage.valid) return Response.json({ success: false, error: imessage.error }, { status: 400, headers: rateLimitHeaders(rl) });
    if (whatsapp && !whatsapp.valid) return Response.json({ success: false, error: whatsapp.error }, { status: 400, headers: rateLimitHeaders(rl) });
    if (telegram && !telegram.valid) return Response.json({ success: false, error: telegram.error }, { status: 400, headers: rateLimitHeaders(rl) });

    let webhookUrl: string | null | undefined = undefined;
    if (body.webhookUrl === null || body.webhookUrl === '') {
      webhookUrl = null;
    } else if (typeof body.webhookUrl === 'string') {
      const checked = isSafeWebhookUrl(body.webhookUrl.trim());
      if (!checked.ok) {
        return Response.json({ success: false, error: checked.error }, { status: 400, headers: rateLimitHeaders(rl) });
      }
      webhookUrl = checked.url;
    }

    const webhookSecret = body.webhookSecret === undefined
      ? undefined
      : body.webhookSecret === null
        ? null
        : validateTextField(body.webhookSecret, 'webhookSecret', 200, false);

    if (webhookSecret && 'valid' in webhookSecret && !webhookSecret.valid) {
      return Response.json({ success: false, error: webhookSecret.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const page = await updateContactPage(slug, ownerToken, {
      name: name?.value,
      bio: bio?.value,
      avatarUrl: avatarUrl?.value,
      webhookUrl,
      webhookSecret: webhookSecret === undefined
        ? undefined
        : webhookSecret === null
          ? null
          : webhookSecret.value || null,
      imessage: imessage?.value,
      whatsapp: whatsapp?.value,
      telegram: telegram?.value,
    });

    if (!page) {
      return Response.json({ success: false, error: 'Page not found or invalid owner token' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    return Response.json({
      ...publicPageJson(page, originFromRequest(request)),
      owner: true,
      webhookUrl: page.webhookUrl,
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]', 'PATCH', rateLimitHeaders(rl));
  }
}
