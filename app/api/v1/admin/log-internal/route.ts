import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

/** Internal endpoint for middleware to log API requests. Not for external use. */
export async function POST(request: NextRequest) {
  // Only accept internal calls
  if (request.headers.get('X-Internal') !== 'true') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { method, endpoint, ip, statusCode } = await request.json();
    await sql`
      INSERT INTO api_logs (method, endpoint, status_code, ip)
      VALUES (${method || ''}, ${endpoint || ''}, ${statusCode || 0}, ${ip || ''})
    `;
    return Response.json({ ok: true });
  } catch {
    // Silently fail - logging should never break the app
    return Response.json({ ok: false });
  }
}
