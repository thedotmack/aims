import { sql } from '@/lib/db';
import { handleApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Bots with claude-mem items (have source_type set)
    const botRows = await sql`
      SELECT
        b.username,
        b.display_name,
        b.last_seen,
        b.is_online,
        (SELECT COUNT(*)::int FROM feed_items f WHERE f.bot_username = b.username) as total_items,
        (SELECT COUNT(*)::int FROM feed_items f WHERE f.bot_username = b.username AND f.source_type IS NOT NULL) as claudemem_items
      FROM bots b
      WHERE EXISTS (SELECT 1 FROM feed_items f WHERE f.bot_username = b.username)
      ORDER BY b.last_seen DESC
      LIMIT 50
    `;

    const bots = botRows.map(r => ({
      username: r.username as string,
      displayName: (r.display_name as string) || (r.username as string),
      lastSeen: (r.last_seen as Date)?.toISOString() || '',
      isOnline: r.is_online as boolean,
      totalItems: r.total_items as number,
      claudeMemItems: r.claudemem_items as number,
    }));

    // Recent items with source_type (claude-mem origin)
    const recentRows = await sql`
      SELECT id, bot_username, feed_type, source_type, content, created_at, metadata
      FROM feed_items
      WHERE source_type IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 30
    `;

    const recentItems = recentRows.map(r => ({
      id: r.id as string,
      botUsername: r.bot_username as string,
      feedType: r.feed_type as string,
      sourceType: r.source_type as string | null,
      content: (r.content as string).slice(0, 300),
      createdAt: (r.created_at as Date)?.toISOString() || '',
      metadata: (r.metadata as Record<string, unknown>) || {},
    }));

    // Hourly ingest rates for last 24h
    const hourlyRows = await sql`
      SELECT date_trunc('hour', created_at) as hour, COUNT(*)::int as count
      FROM feed_items
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY date_trunc('hour', created_at)
      ORDER BY hour ASC
    `;

    const hourlyRates = hourlyRows.map(r => ({
      hour: (r.hour as Date)?.toISOString() || '',
      count: r.count as number,
    }));

    // Recent errors from webhook_deliveries
    const errorRows = await sql`
      SELECT id, bot_username, status, error_message, created_at
      FROM webhook_deliveries
      WHERE status = 'error' OR status = 'rejected'
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const errors = errorRows.map(r => ({
      id: r.id as string,
      botUsername: r.bot_username as string,
      status: r.status as string,
      errorMessage: r.error_message as string | null,
      createdAt: (r.created_at as Date)?.toISOString() || '',
    }));

    return Response.json({
      success: true,
      data: { bots, recentItems, hourlyRates, errors },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (err: unknown) {
    return handleApiError(err, '/api/v1/integrations/claude-mem/dashboard', 'GET');
  }
}
