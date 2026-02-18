
import { subscribeToDigest } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, frequency } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return Response.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      );
    }

    if (!['daily', 'weekly'].includes(frequency)) {
      return Response.json(
        { success: false, error: 'Frequency must be "daily" or "weekly"' },
        { status: 400 }
      );
    }

    const result = await subscribeToDigest(email.toLowerCase().trim(), frequency);

    if (!result.success) {
      return Response.json(
        { success: false, error: 'Failed to subscribe' },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: result.existing
        ? 'Updated your subscription preferences!'
        : "You've Got Mail! 📬 Welcome to the AIMs digest.",
      existing: result.existing || false,
    });
  } catch {
    return Response.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
