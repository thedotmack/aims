import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, getClientIp, LIMITS, rateLimitHeaders, rateLimitResponse } from '@/lib/ratelimit';
import { validateTextField } from '@/lib/validation';
import {
  getContactMessageById,
  getPageBySlug,
  incrementReplyCount,
  setDiscordReplyMessageId,
} from '@/lib/contact-pages';
import { verifyStoredSecret } from '@/lib/crypto-tokens';
import { DISCORD_REPLY_FOLLOWUPS, formatAimsReply } from '@/lib/discord-loop';
import { discordCreateMessage } from '@/lib/discord';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string; id: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.CONTACT_MESSAGE, `reply:${ip}`);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]/messages/[id]/reply', ip);

  try {
    const { slug, id } = await context.params;
    const page = await getPageBySlug(slug);
    if (!page) {
      return Response.json({ success: false, error: 'Page not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const message = await getContactMessageById(id);
    if (!message || message.pageId !== page.id) {
      return Response.json({ success: false, error: 'unknown' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const token = request.headers.get('x-aims-reply-token') || '';
    if (!message.replyTokenHash || !verifyStoredSecret(message.replyTokenHash, token)) {
      return Response.json({ success: false, error: 'bad_token' }, { status: 401, headers: rateLimitHeaders(rl) });
    }

    if (message.replyExpiresAt && new Date(message.replyExpiresAt).getTime() <= Date.now()) {
      return Response.json({ success: false, error: 'expired' }, { status: 410, headers: rateLimitHeaders(rl) });
    }

    if ((message.replyCount || 0) >= DISCORD_REPLY_FOLLOWUPS) {
      return Response.json({ success: false, error: 'reply_limit' }, { status: 409, headers: rateLimitHeaders(rl) });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ success: false, error: 'Invalid JSON in request body' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const content = validateTextField(body.content ?? body.message ?? body.ack, 'content', 4000, true);
    if (!content.valid) {
      return Response.json({ success: false, error: content.error }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const handle = message.discord?.handle || page.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '') || 'bot';
    const channelId = message.discord?.channelId;
    if (!channelId) {
      return Response.json({ success: false, error: 'not_discord' }, { status: 409, headers: rateLimitHeaders(rl) });
    }

    const posted = await discordCreateMessage({
      channelId,
      content: formatAimsReply(handle, content.value),
      messageReference: message.discord?.sourceMessageId
        ? {
            messageId: message.discord.sourceMessageId,
            channelId,
            guildId: message.discord.guildId,
          }
        : undefined,
    });

    if (!posted.ok) {
      return Response.json({ success: false, error: posted.error }, { status: posted.status === 429 ? 429 : 502, headers: rateLimitHeaders(rl) });
    }

    await incrementReplyCount(message.id);
    await setDiscordReplyMessageId(message.id, posted.messageId);

    return Response.json({
      success: true,
      discord: { messageId: posted.messageId, channelId: posted.channelId },
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]/messages/[id]/reply', 'POST', rateLimitHeaders(rl));
  }
}
