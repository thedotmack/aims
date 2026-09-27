import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, getClientIp, LIMITS, rateLimitHeaders, rateLimitResponse } from '@/lib/ratelimit';
import {
  extractOwnerTokenHeaderOnly,
  getPageBySlug,
  publicPageJson,
  verifyOwnerToken,
} from '@/lib/contact-pages';
import {
  deleteDiscordBindingsForPage,
  getBindingsForPage,
  slugifyHandle,
  upsertDiscordBinding,
} from '@/lib/discord-store';
import { discordGetBotMember } from '@/lib/discord';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]/discord', ip);

  try {
    const { slug } = await context.params;
    const ownerToken = extractOwnerTokenHeaderOnly(request);
    if (!ownerToken) {
      return Response.json({ success: false, error: 'Owner token required' }, { status: 401, headers: rateLimitHeaders(rl) });
    }
    const page = await getPageBySlug(slug);
    if (!page || !verifyOwnerToken(page, ownerToken)) {
      return Response.json({ success: false, error: 'Page not found or invalid owner token' }, { status: 404, headers: rateLimitHeaders(rl) });
    }
    const bindings = await getBindingsForPage(page.id);
    return Response.json({
      success: true,
      discord: bindings.map((b) => ({
        guildId: b.guildId,
        channelId: b.channelId,
        handle: b.mentionHandle,
        mention: `@aims ${b.mentionHandle}`,
      })),
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]/discord', 'GET', rateLimitHeaders(rl));
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]/discord', ip);

  try {
    const { slug } = await context.params;
    const ownerToken = extractOwnerTokenHeaderOnly(request);
    if (!ownerToken) {
      return Response.json({ success: false, error: 'Owner token required (Authorization or X-Owner-Token)' }, { status: 401, headers: rateLimitHeaders(rl) });
    }
    const page = await getPageBySlug(slug);
    if (!page || !verifyOwnerToken(page, ownerToken)) {
      return Response.json({ success: false, error: 'Page not found or invalid owner token' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON in request body' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const guildId = String(body.guildId || '');
    const channelId = String(body.channelId || '');
    const handle = slugifyHandle(String(body.handle || page.name));
    if (!guildId || !channelId) {
      return Response.json({ success: false, error: 'guildId and channelId required' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const member = await discordGetBotMember(guildId);
    if (!member) {
      return Response.json({ success: false, error: 'bot_not_in_guild' }, { status: 409, headers: rateLimitHeaders(rl) });
    }

    const binding = await upsertDiscordBinding({
      pageId: page.id,
      guildId,
      channelId,
      mentionHandle: handle,
    });

    return Response.json({
      success: true,
      ...publicPageJson(page),
      discord: {
        guildId: binding.guildId,
        channelId: binding.channelId,
        handle: binding.mentionHandle,
        mention: `@aims ${binding.mentionHandle}`,
      },
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]/discord', 'POST', rateLimitHeaders(rl));
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.AUTH_WRITE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]/discord', ip);

  try {
    const { slug } = await context.params;
    const ownerToken = extractOwnerTokenHeaderOnly(request);
    if (!ownerToken) {
      return Response.json({ success: false, error: 'Owner token required' }, { status: 401, headers: rateLimitHeaders(rl) });
    }
    const page = await getPageBySlug(slug);
    if (!page || !verifyOwnerToken(page, ownerToken)) {
      return Response.json({ success: false, error: 'Page not found or invalid owner token' }, { status: 404, headers: rateLimitHeaders(rl) });
    }
    const removed = await deleteDiscordBindingsForPage(page.id);
    return Response.json({ success: true, removed }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]/discord', 'DELETE', rateLimitHeaders(rl));
  }
}
