import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** Admin: list all bots with full details including API keys and feed counts */
export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    const rows = await sql`
      SELECT b.*,
        (SELECT COUNT(*)::int FROM feed_items f WHERE f.bot_username = b.username) as feed_count
      FROM bots b
      ORDER BY b.created_at DESC
    `;

    const bots = rows.map(r => ({
      id: r.id as string,
      username: r.username as string,
      displayName: (r.display_name as string) || '',
      isOnline: r.is_online as boolean,
      apiKey: r.api_key as string,
      feedCount: r.feed_count as number,
      lastSeen: r.last_seen ? (r.last_seen as Date).toISOString() : null,
      createdAt: r.created_at ? (r.created_at as Date).toISOString() : null,
    }));

    return Response.json({ success: true, bots });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/bots', 'GET');
  }
}
