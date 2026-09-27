import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, getClientIp, LIMITS, rateLimitResponse } from '@/lib/ratelimit';
import { deliverConnectReady, getPageById, originFromRequest } from '@/lib/contact-pages';
import { verifyClaimState } from '@/lib/crypto-tokens';
import {
  discordExchangeCode,
  discordGetBotMember,
  discordGetUserGuilds,
  discordStateKey,
  pickDefaultSendableChannel,
  userHasManageGuild,
} from '@/lib/discord';
import { claimStatus, consumeClaim, getClaimBySecret, slugifyHandle, upsertDiscordBinding } from '@/lib/discord-store';

function htmlPage(title: string, body: string, status = 200) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#111;color:#f5f5f5;padding:48px;max-width:40rem;margin:auto;line-height:1.5}</style>
</head><body>${body}</body></html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.DISCORD_CLAIM_REDEEM_IP, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/discord/oauth/callback', ip);
  const globalRl = await checkRateLimitAsync(LIMITS.DISCORD_CLAIM_REDEEM_GLOBAL, 'global');
  if (!globalRl.allowed) return rateLimitResponse(globalRl, '/api/v1/discord/oauth/callback', ip);

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    const hintedGuild = url.searchParams.get('guild_id') || '';
    if (!code || !state) {
      return htmlPage('Discord connect failed', '<p>Missing OAuth code or state.</p>', 400);
    }

    const claimSecret = verifyClaimState(state, discordStateKey() || 'dev-state-key');
    if (!claimSecret) {
      return htmlPage('Discord connect failed', '<p>Invalid or tampered connect state.</p>', 401);
    }

    const claim = await getClaimBySecret(claimSecret);
    if (!claim || claimStatus(claim) !== 'pending') {
      return htmlPage('Discord connect failed', '<p>This claim is expired or already used.</p>', 410);
    }

    const origin = originFromRequest(request);
    const redirectUri = `${origin}/api/v1/discord/oauth/callback`;
    const token = await discordExchangeCode(code, redirectUri);
    if (!token?.access_token) {
      return htmlPage('Discord connect failed', '<p>Could not exchange the Discord authorization code.</p>', 400);
    }

    let guildId = hintedGuild || token.guild?.id || '';
    if (!guildId) {
      const guilds = await discordGetUserGuilds(token.access_token);
      const managed = guilds.find((g) => userHasManageGuild(g.permissions));
      guildId = managed?.id || '';
    }
    if (!guildId) {
      return htmlPage('Discord connect failed', '<p>No guild was authorized. Pick a server and try again.</p>', 400);
    }

    const member = await discordGetBotMember(guildId);
    if (!member) {
      return htmlPage('Discord connect failed', '<p>aims is not a member of that server yet. Authorize the bot and retry.</p>', 409);
    }

    const channelId = await pickDefaultSendableChannel(guildId);
    if (!channelId) {
      return htmlPage('Discord connect failed', '<p>No sendable text channel was found. Use /aims here in the channel you want.</p>', 409);
    }

    const consumed = await consumeClaim(claim.id);
    if (!consumed) {
      return htmlPage('Discord connect failed', '<p>This claim was already consumed.</p>', 409);
    }

    const page = await getPageById(claim.pageId);
    if (!page) {
      return htmlPage('Discord connect failed', '<p>The contact page for this claim is gone.</p>', 404);
    }

    const handle = slugifyHandle(page.name);
    await upsertDiscordBinding({
      pageId: page.id,
      guildId,
      channelId,
      mentionHandle: handle,
    });
    await deliverConnectReady(page, { guildId, channelId, handle });

    return htmlPage(
      'aims is live',
      `<h1>@aims ${handle} is live</h1>
       <p>Wrong channel? Type <code>/aims here</code> there.</p>
       <p>Talk with <code>@aims ${handle} hello</code> or <code>/aims ask ${handle}</code>.</p>`
    );
  } catch (err) {
    return handleApiError(err, '/api/v1/discord/oauth/callback', 'GET');
  }
}
