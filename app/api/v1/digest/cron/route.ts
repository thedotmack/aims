import { NextRequest } from 'next/server';
import { sendDigestToSubscribers } from '@/lib/digest';
import { isEmailConfigured } from '@/lib/email';

/**
 * Cron-triggered digest endpoint.
 *
 * Designed for Vercel Cron Jobs (vercel.json) or external schedulers.
 * Auth: CRON_SECRET header (Vercel sends this automatically for cron jobs).
 * Falls back to AIMS_ADMIN_KEY if CRON_SECRET is not configured.
 *
 * GET /api/v1/digest/cron?frequency=daily
 * GET /api/v1/digest/cron?frequency=weekly
 */
export async function GET(request: NextRequest) {
  // Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  const adminKey = process.env.AIMS_ADMIN_KEY;
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const authorized =
    (cronSecret && bearerToken === cronSecret) ||
    (adminKey && bearerToken === adminKey);

  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const frequency = request.nextUrl.searchParams.get('frequency') === 'weekly' ? 'weekly' : 'daily';

  if (!isEmailConfigured()) {
    return Response.json({
      success: false,
      error: 'Email not configured',
      configured: false,
    }, { status: 503 });
  }

  try {
    const result = await sendDigestToSubscribers(frequency, {
      triggerSource: 'cron',
      skipIdempotencyCheck: false,
    });

    if (result.skipped && result.reason === 'already_sent_within_window') {
      // Return 200 for cron (don't trigger retry alerts) but note it was skipped
      return Response.json({
        success: true,
        skipped: true,
        reason: result.reason,
        runId: result.runId,
      });
    }

    return Response.json({
      success: true,
      ...result,
    });
  } catch {
    return Response.json({ success: false, error: 'Digest send failed' }, { status: 500 });
  }
}
