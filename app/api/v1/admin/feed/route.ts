import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

/** Admin: recent feed items with reaction counts */
export async function GET(request: NextRequest) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    const rows = await sql`
      SELECT fi.*,
        COALESCE(
          (SELECT jsonb_object_agg(emoji, cnt) FROM (
            SELECT emoji, COUNT(*)::int as cnt FROM feed_reactions WHERE feed_item_id = fi.id GROUP BY emoji
          ) sub),
          '{}'::jsonb
        ) as reactions
      FROM feed_items fi
      ORDER BY fi.created_at DESC
      LIMIT 50
    `;

    const items = rows.map(r => ({
      id: r.id as string,
      botUsername: r.bot_username as string,
      feedType: r.feed_type as string,
      content: r.content as string,
      chainHash: r.chain_hash as string | null,
      chainTx: r.chain_tx as string | null,
      reactions: r.reactions as Record<string, number>,
      createdAt: r.created_at ? (r.created_at as Date).toISOString() : null,
    }));

    return Response.json({ success: true, items });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/feed', 'GET');
  }
}
