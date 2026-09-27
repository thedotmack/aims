import { NextRequest } from 'next/server';
import { originFromRequest, getPageById, getPageBySlug } from '@/lib/contact-pages';
import { findSlashOption, slashString, verifyDiscordInteraction, type SlashOption } from '@/lib/discord-interact';
import { discordClientId, discordGetBotMember, discordInteractionFollowup, discordPublicKey } from '@/lib/discord';
import { claimStatus, consumeClaim, getClaimByCode, resolveDiscordBinding, slugifyHandle, upsertDiscordBinding } from '@/lib/discord-store';
import { wakeBoundPage } from '@/lib/discord-events';

function pong() {
  return Response.json({ type: 1 });
}

function channelMessage(content: string) {
  return Response.json({
    type: 4,
    data: { content, allowed_mentions: { parse: [] } },
  });
}

function defer() {
  return Response.json({ type: 5 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-signature-timestamp') || '';
  const signature = request.headers.get('x-signature-ed25519') || '';
  const ok = verifyDiscordInteraction({
    publicKeyHex: discordPublicKey(),
    timestamp,
    signatureHex: signature,
    rawBody,
  });
  if (!ok) {
    return new Response('invalid request signature', { status: 401 });
  }

  let body: {
    type?: number;
    token?: string;
    application_id?: string;
    guild_id?: string;
    channel_id?: string;
    data?: { name?: string; options?: SlashOption[] };
    member?: { user?: { id?: string; username?: string } };
    user?: { id?: string; username?: string };
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  if (body.type === 1) return pong();
  if (body.type !== 2) return channelMessage('Unsupported interaction.');

  const sub = body.data?.options?.[0];
  const command = body.data?.name;
  const subName = sub?.name || command;
  const options = (sub?.options || body.data?.options || []) as SlashOption[];
  const guildId = body.guild_id || '';
  const channelId = body.channel_id || '';

  if (command === 'aims' && (subName === 'here' || findSlashOption(body.data?.options, 'here'))) {
    if (!guildId || !channelId) return channelMessage('Use this in a server channel.');
    const member = await discordGetBotMember(guildId);
    if (!member) return channelMessage('aims is not in this server.');
    const handle = slugifyHandle(slashString(options, 'handle') || 'bot');
    const existing = await resolveDiscordBinding({ guildId, channelId, handle });
    const page = existing ? await getPageById(existing.pageId) : await getPageBySlug(handle);
    if (!page) return channelMessage(`No aims page for \`${handle}\`. Create one, then /aims claim.`);
    await upsertDiscordBinding({ pageId: page.id, guildId, channelId, mentionHandle: handle });
    return channelMessage(`Bound \`@aims ${handle}\` to this channel. Wrong page? Pass the handle: \`/aims here handle:${handle}\`.`);
  }

  if (command === 'aims' && (subName === 'claim' || findSlashOption(body.data?.options, 'claim'))) {
    if (!guildId || !channelId) return channelMessage('Use this in a server channel.');
    const code = slashString(options, 'code');
    const claim = await getClaimByCode(code);
    if (!claim || claimStatus(claim) !== 'pending') return channelMessage('That claim is invalid or expired.');
    const member = await discordGetBotMember(guildId);
    if (!member) return channelMessage('aims is not a member of this server.');
    const consumed = await consumeClaim(claim.id);
    if (!consumed) return channelMessage('That claim was already used.');
    const page = await getPageById(claim.pageId);
    if (!page) return channelMessage('The page for that claim is gone.');
    const handle = slugifyHandle(page.name);
    await upsertDiscordBinding({ pageId: page.id, guildId, channelId, mentionHandle: handle });
    return channelMessage(`\`@aims ${handle}\` is live in this channel.`);
  }

  if (command === 'aims' && (subName === 'ask' || findSlashOption(body.data?.options, 'ask'))) {
    if (!guildId || !channelId) return channelMessage('Use this in a server channel.');
    const handle = slugifyHandle(slashString(options, 'handle'));
    const text = slashString(options, 'text');
    const binding = await resolveDiscordBinding({ guildId, channelId, handle });
    if (!binding) return channelMessage(`No binding for \`${handle}\`. Try \`/aims here\` first.`);
    const page = await getPageById(binding.pageId);
    if (!page) return channelMessage('The bound page is gone.');

    const origin = originFromRequest(request);
    const appId = body.application_id || discordClientId();
    const token = body.token || '';
    void wakeBoundPage({
      page,
      bindingHandle: binding.mentionHandle,
      fromName: body.member?.user?.username || body.user?.username || 'discord',
      content: text,
      hop: 0,
      guildId,
      channelId,
      threadId: null,
      sourceMessageId: `interaction:${Date.now()}`,
      origin,
    }).then(async (result) => {
      if (token && appId) {
        const content = result.ok && result.wakes
          ? `Woke \`@aims ${binding.mentionHandle}\`.`
          : `Could not wake \`@aims ${binding.mentionHandle}\`.`;
        await discordInteractionFollowup(appId, token, content).catch(() => {});
      }
    });
    return defer();
  }

  return channelMessage('Try `/aims here`, `/aims claim`, or `/aims ask`.');
}
