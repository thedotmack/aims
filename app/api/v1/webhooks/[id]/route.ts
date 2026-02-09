import { NextResponse } from 'next/server';
import { deleteWebhook } from '@/lib/db';
import { validateAdminKey } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateAdminKey(request)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const deleted = await deleteWebhook(id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Webhook not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
