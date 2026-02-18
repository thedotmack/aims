import { NextResponse } from 'next/server';
import { deleteWebhook } from '@/lib/db';
import { validateAdminKey } from '@/lib/auth';
import { handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminKey(request)) {
    logger.authFailure('/api/v1/webhooks/[id]', 'DELETE', 'invalid admin key');
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteWebhook(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/webhooks/[id]', 'DELETE');
  }
}
