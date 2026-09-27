import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, getClientIp, LIMITS, rateLimitHeaders, rateLimitResponse } from '@/lib/ratelimit';
import { getPageById } from '@/lib/contact-pages';
import { normalizeClaimCode, verifyStoredSecret } from '@/lib/crypto-tokens';
import { claimStatus, getBindingForPage, getClaimByCode, getClaimBySecret } from '@/lib/discord-store';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/claims/[code]', ip);

  try {
    const { code } = await context.params;
    const claim = await getClaimByCode(normalizeClaimCode(code));
    if (!claim) {
      return Response.json({ success: false, error: 'not_found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const status = claimStatus(claim);
    const secret = request.headers.get('x-aims-claim-secret') || '';
    const secretOk = Boolean(secret && verifyStoredSecret(claim.secretHash, secret));

    if (!secretOk) {
      return Response.json({ success: true, status }, { headers: rateLimitHeaders(rl) });
    }

    const authorized = await getClaimBySecret(secret);
    if (!authorized || authorized.id !== claim.id) {
      return Response.json({ success: true, status }, { headers: rateLimitHeaders(rl) });
    }

    const page = await getPageById(claim.pageId);
    const binding = page ? await getBindingForPage(page.id) : null;
    return Response.json({
      success: true,
      status,
      ...(status === 'bound' && page && binding ? {
        page: { slug: page.slug, name: page.name },
        discord: { guildId: binding.guildId, channelId: binding.channelId, handle: binding.mentionHandle },
      } : {}),
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/claims/[code]', 'GET', rateLimitHeaders(rl));
  }
}
