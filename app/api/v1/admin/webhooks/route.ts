import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getWebhookDeliveries } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** Admin: get recent webhook deliveries */
export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    try {
      const deliveries = await getWebhookDeliveries(100);
      return Response.json({ success: true, deliveries });
    } catch {
      return Response.json({ success: true, deliveries: [], note: 'webhook_deliveries table not yet created' });
    }
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/webhooks', 'GET');
  }
}
