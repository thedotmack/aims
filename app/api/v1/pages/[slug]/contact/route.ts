import { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/errors';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { getPageBySlug, originFromRequest, toPublicPageWithBindings } from '@/lib/contact-pages';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/pages/[slug]/contact', ip);

  try {
    const { slug } = await context.params;
    const page = await getPageBySlug(slug);
    if (!page) {
      return Response.json({ success: false, error: 'Page not found' }, { status: 404, headers: rateLimitHeaders(rl) });
    }

    const pub = await toPublicPageWithBindings(page, originFromRequest(request));
    return Response.json({
      success: true,
      slug: page.slug,
      name: page.name,
      contacts: pub.contacts,
      bot2bot: pub.bot2bot,
      messageUrl: pub.urls.message,
    }, { headers: rateLimitHeaders(rl) });
  } catch (err) {
    return handleApiError(err, '/api/v1/pages/[slug]/contact', 'GET', rateLimitHeaders(rl));
  }
}
