import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { sql } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

/** Admin: delete a feed item */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const authErr = requireAdmin(request);
  if (authErr) return authErr;

  try {
    const { itemId } = await params;
    await sql`DELETE FROM feed_reactions WHERE feed_item_id = ${itemId}`;
    const result = await sql`DELETE FROM feed_items WHERE id = ${itemId} RETURNING id`;
    if (result.length === 0) {
      return Response.json({ success: false, error: 'Item not found' }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/admin/feed/[itemId]', 'DELETE');
  }
}
