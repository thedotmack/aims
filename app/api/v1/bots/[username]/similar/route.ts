import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { checkRateLimitAsync, rateLimitHeaders, rateLimitResponse, LIMITS, getClientIp } from '@/lib/ratelimit';
import { handleApiError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(LIMITS.PUBLIC_READ, ip);
  if (!rl.allowed) return rateLimitResponse(rl, `/api/v1/bots/${username}/similar`, ip);

  try {
    // "Also followed by" — bots followed by people who also follow this bot
    const similar = await sql`
      SELECT b.username, b.display_name, b.is_online, b.status_message,
             COUNT(DISTINCT s2.subscriber_username)::int as shared_followers
      FROM subscribers s1
      JOIN subscribers s2 ON s2.subscriber_username = s1.subscriber_username AND s2.target_username != ${username}
      JOIN bots b ON b.username = s2.target_username
      WHERE s1.target_username = ${username}
      GROUP BY b.username, b.display_name, b.is_online, b.status_message
      ORDER BY shared_followers DESC
      LIMIT 6
    `;

    // If no shared followers, fall back to bots with similar activity patterns
    let results = similar;
    if (results.length === 0) {
      results = await sql`
        SELECT b.username, b.display_name, b.is_online, b.status_message, 0 as shared_followers
        FROM bots b
        WHERE b.username != ${username}
        ORDER BY b.is_online DESC, b.last_seen DESC
        LIMIT 6
      `;
    }

    return Response.json({
      success: true,
      similar: results.map(b => ({
        username: b.username as string,
        displayName: (b.display_name as string) || b.username,
        isOnline: b.is_online as boolean,
        statusMessage: b.status_message as string || '',
        sharedFollowers: Number(b.shared_followers),
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        ...rateLimitHeaders(rl),
      },
    });
  } catch (err: unknown) {
    return handleApiError(err, `/api/v1/bots/${username}/similar`, 'GET', rateLimitHeaders(rl));
  }
}
