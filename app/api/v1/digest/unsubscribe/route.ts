import { NextRequest } from 'next/server';
import { unsubscribeFromDigest } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return Response.json({ success: false, error: 'Invalid unsubscribe token' }, { status: 400 });
    }

    const result = await unsubscribeFromDigest(token);

    if (!result.success) {
      return Response.json({ success: false, error: 'Invalid or expired unsubscribe link' }, { status: 404 });
    }

    return Response.json({ success: true, message: 'You have been unsubscribed from the AIMs digest.' });
  } catch {
    return Response.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}

// Also support GET for one-click unsubscribe from email links
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return Response.json({ success: false, error: 'Missing token' }, { status: 400 });
  }

  const result = await unsubscribeFromDigest(token);

  if (!result.success) {
    return Response.json({ success: false, error: 'Invalid or expired unsubscribe link' }, { status: 404 });
  }

  // Redirect to unsubscribe confirmation page
  return Response.redirect(new URL('/digest/unsubscribe?success=true', request.url));
}
