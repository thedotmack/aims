import {
  createContactMessage,
  deliverOwnerWebhook,
  getPageById,
  setDiscordReplyMessageId,
  siteOrigin,
  type ContactPage,
} from './contact-pages';
import {
  createReplySecret,
  getParentHopForReference,
  isPairCoolingDown,
  rememberEventNonce,
  resolveDiscordBinding,
} from './discord-store';
import {
  computeHop,
  formatAimsReply,
  hopExceeded,
  isSelfAuthor,
  messageMentionsBot,
  pairCooldownKey,
  parseHandleAfterMention,
} from './discord-loop';
import { discordBotUserId, discordClientId, discordCreateMessage } from './discord';
import { checkRateLimitAsync, LIMITS } from './ratelimit';

export interface DiscordMessageLike {
  id?: string;
  channel_id?: string;
  guild_id?: string;
  content?: string;
  author?: { id?: string; username?: string; bot?: boolean; application_id?: string };
  mentions?: Array<{ id?: string }>;
  message_reference?: { message_id?: string; channel_id?: string; guild_id?: string };
  thread?: { id?: string };
}

export type DiscordEventResult =
  | { ok: true; wakes: number; ignored?: undefined; messageId?: string }
  | { ok: true; wakes: 0; ignored: string }
  | { ok: false; error: string; status: number };

export async function processDiscordMessageCreate(
  message: DiscordMessageLike,
  opts?: { origin?: string }
): Promise<DiscordEventResult> {
  const botUserId = discordBotUserId();
  const appId = discordClientId();
  if (!botUserId) return { ok: true, wakes: 0, ignored: 'not_configured' };

  if (!message.id || !message.channel_id || !message.guild_id) {
    return { ok: true, wakes: 0, ignored: 'malformed' };
  }

  if (isSelfAuthor(message.author, botUserId, appId)) {
    return { ok: true, wakes: 0, ignored: 'self' };
  }

  if (!messageMentionsBot(message.mentions, botUserId)) {
    return { ok: true, wakes: 0, ignored: 'no_mention' };
  }

  const parsed = parseHandleAfterMention(message.content || '', botUserId);
  const binding = await resolveDiscordBinding({
    guildId: message.guild_id,
    channelId: message.channel_id,
    handle: parsed.handle,
  });
  if (!binding) {
    return { ok: true, wakes: 0, ignored: 'no_binding' };
  }

  let hop = 0;
  if (message.message_reference?.message_id) {
    const parentHop = await getParentHopForReference(message.message_reference.message_id);
    if (parentHop != null) hop = computeHop(parentHop);
  }
  if (hopExceeded(hop)) {
    return { ok: true, wakes: 0, ignored: 'hop_exceeded' };
  }

  const pageRl = await checkRateLimitAsync(LIMITS.DISCORD_WAKE, `page:${binding.pageId}`);
  const authorKey = message.author?.id || 'unknown';
  const authorRl = await checkRateLimitAsync(LIMITS.DISCORD_WAKE_AUTHOR, `page:${binding.pageId}:author:${authorKey}`);
  const guildRl = await checkRateLimitAsync(LIMITS.DISCORD_WAKE_GUILD, `guild:${message.guild_id}`);
  if (!pageRl.allowed || !authorRl.allowed || !guildRl.allowed) {
    return { ok: true, wakes: 0, ignored: 'rate_limited' };
  }

  const cooling = await isPairCoolingDown(pairCooldownKey({
    guildId: message.guild_id,
    fromKey: authorKey,
    pageId: binding.pageId,
    content: message.content || '',
  }));
  if (cooling) {
    return { ok: true, wakes: 0, ignored: 'cooldown' };
  }

  const page = await getPageById(binding.pageId);
  if (!page) return { ok: true, wakes: 0, ignored: 'no_page' };
  if (!page.webhookUrl) return { ok: true, wakes: 0, ignored: 'no_webhook' };

  return wakeBoundPage({
    page,
    bindingHandle: binding.mentionHandle,
    fromName: message.author?.username || 'discord',
    content: parsed.rest || parsed.handle || message.content || '',
    hop,
    guildId: message.guild_id,
    channelId: message.channel_id,
    threadId: message.thread?.id || null,
    sourceMessageId: message.id,
    origin: opts?.origin,
  });
}

export async function wakeBoundPage(input: {
  page: ContactPage;
  bindingHandle: string;
  fromName: string;
  content: string;
  hop: number;
  guildId: string;
  channelId: string;
  threadId: string | null;
  sourceMessageId: string;
  origin?: string;
}): Promise<DiscordEventResult> {
  const origin = input.origin || siteOrigin();
  const discord = {
    guildId: input.guildId,
    channelId: input.channelId,
    threadId: input.threadId,
    sourceMessageId: input.sourceMessageId,
    handle: input.bindingHandle,
    hop: input.hop,
  };

  const message = await createContactMessage(input.page, {
    fromName: input.fromName,
    content: input.content,
    source: 'discord',
    hop: input.hop,
    discord,
  });
  const reply = await createReplySecret(message.id);
  const replyUrl = `${origin}/api/v1/pages/${input.page.slug}/messages/${message.id}/reply`;

  const delivery = await deliverOwnerWebhook(input.page, {
    ...message,
    replyTo: replyUrl,
    discord,
  }, {
    discord,
    reply: { url: replyUrl, token: reply.token, expiresAt: reply.expiresAt },
  });

  if (delivery.ack) {
    const posted = await discordCreateMessage({
      channelId: input.channelId,
      content: formatAimsReply(input.bindingHandle, delivery.ack),
      messageReference: {
        messageId: input.sourceMessageId,
        channelId: input.channelId,
        guildId: input.guildId,
      },
    });
    if (posted.ok) {
      await setDiscordReplyMessageId(message.id, posted.messageId);
    }
  }

  return { ok: true, wakes: 1, messageId: message.id };
}

export async function reserveDiscordDelivery(nonce: string, messageId: string | null): Promise<
  { ok: true } | { ok: false; reason: 'nonce' | 'message' }
> {
  return rememberEventNonce(nonce, messageId);
}
