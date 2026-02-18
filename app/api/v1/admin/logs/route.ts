import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** Admin: get recent API logs */
export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    // Table may not exist yet
    try {
      const rows = await sql`
        SELECT * FROM api_logs ORDER BY created_at DESC LIMIT 50
      `;
      return Response.json({ success: true, logs: rows });
    } catch {
      return Response.json({ success: true, logs: [], note: 'api_logs table not yet created' });
    }
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/logs', 'GET');
  }
}
