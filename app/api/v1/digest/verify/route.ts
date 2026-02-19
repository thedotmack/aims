import { NextRequest } from 'next/server';
import { verifyDigestSubscriber } from '@/lib/db';
import { checkRateLimitAsync, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, '/api/v1/digest/verify', ip);

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) {
    return Response.json({ success: false, error: 'Verification token is required' }, { status: 400 });
  }

  const result = await verifyDigestSubscriber(token);
  if (!result.success) {
    return Response.json({ success: false, error: 'Invalid or expired verification token' }, { status: 404 });
  }

  return Response.json({
    success: true,
    email: result.email,
    alreadyVerified: result.alreadyVerified || false,
    message: result.alreadyVerified ? 'Email already verified!' : 'Email verified successfully! You will now receive digest emails.',
  });
}
