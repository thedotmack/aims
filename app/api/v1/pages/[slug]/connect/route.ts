import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, getClientIp, LIMITS, rateLimitHeaders, rateLimitResponse } from '@/lib/ratelimit';
import {
  extractOwnerTokenHeaderOnly,
  getPageBySlug,
  originFromRequest,
  verifyOwnerToken,
} from '@/lib/contact-pages';
import { countClaimsForPageLastHour, createClaim } from '@/lib/discord-store';
import { buildInstallUrl, discordClientId, discordStateKey } from '@/lib/discord';
import { signClaimState } from '@/lib/crypto-tokens';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.DISCORD_CLAIM_CREATE, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]/connect', ip);

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

    const created = await countClaimsForPageLastHour(page.id);
    if (created >= 10) {
      return Response.json({ success: false, error: 'claim_rate_limited' }, { status: 429, headers: rateLimitHeaders(rl) });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const channels = Array.isArray(body.channels) ? body.channels.map(String) : ['discord'];
    if (!channels.includes('discord')) {
      return Response.json({ success: false, error: 'unsupported_channel' }, { status: 400, headers: rateLimitHeaders(rl) });
    }

    const claim = await createClaim(page.id);
    const origin = originFromRequest(request);
    const redirectUri = `${origin}/api/v1/discord/oauth/callback`;
    const state = signClaimState(claim.claimSecret, discordStateKey() || 'dev-state-key');
    const installUrl = buildInstallUrl({
      clientId: discordClientId() || 'pending-client-id',
      redirectUri,
      state,
    });

    return Response.json({
      success: true,
      claim: claim.claim,
      claimSecret: claim.claimSecret,
      expiresAt: claim.expiresAt,
      discord: { installUrl },
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]/connect', 'POST', rateLimitHeaders(rl));
  }
}
