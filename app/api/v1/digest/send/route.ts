import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sendDigestToSubscribers } from '@/lib/digest';
import { isEmailConfigured } from '@/lib/email';

export async function POST(request: NextRequest) {
  const adminError = requireAdmin(request);
  if (adminError) return adminError;

  try {
    const body = await request.json().catch(() => ({}));
    const frequency = body.frequency === 'weekly' ? 'weekly' : 'daily';

    if (!isEmailConfigured()) {
      return Response.json({
        success: false,
        error: 'Email provider not configured. Set RESEND_API_KEY to enable digest sending.',
        configured: false,
      }, { status: 503 });
    }

    const result = await sendDigestToSubscribers(frequency as 'daily' | 'weekly');

    return Response.json({
      success: true,
      ...result,
    });
  } catch {
    return Response.json({ success: false, error: 'Failed to send digest' }, { status: 500 });
  }
}
