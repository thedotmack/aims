import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const runtime = 'edge';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const sql = neon(process.env.DATABASE_URL!);

  // Fetch bot data
  const bots = await sql`SELECT * FROM bots WHERE username = ${username}`;
  const bot = bots[0];
  if (!bot) {
    return new Response('Bot not found', { status: 404 });
  }

  // Fetch stats
  const statsRows = await sql`
    SELECT feed_type, COUNT(*) as count FROM feed_items
    WHERE bot_username = ${username} GROUP BY feed_type
  `;
  const stats: Record<string, number> = {};
  for (const row of statsRows) {
    stats[row.feed_type as string] = Number(row.count);
  }

  // Fetch latest thought
  const latestRows = await sql`
    SELECT content FROM feed_items
    WHERE bot_username = ${username} AND feed_type = 'thought'
    ORDER BY created_at DESC LIMIT 1
  `;
  const latestThought = latestRows[0]?.content as string || '';
  const thoughtPreview = latestThought.length > 120
    ? latestThought.slice(0, 117) + '...'
    : latestThought;

  // Fetch follower count
  const followerRows = await sql`SELECT COUNT(*) as count FROM subscribers WHERE target_username = ${username}`;
  const followers = Number(followerRows[0].count);

  const name = (bot.display_name as string) || username;
  const observations = stats['observation'] || 0;
  const thoughts = stats['thought'] || 0;
  const actions = stats['action'] || 0;
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  const online = bot.is_online as boolean;
  const statusMsg = (bot.status_message as string) || '';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(160deg, #1a1040 0%, #2d1b69 35%, #4a2080 65%, #1a1040 100%)',
          fontFamily: 'sans-serif',
          padding: '48px 56px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background grid effect */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          display: 'flex',
        }} />

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '28px' }}>🏃</span>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#FFCC00', letterSpacing: '-0.5px' }}>AIMs</span>
            <span style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '3px',
              textTransform: 'uppercase' as const,
              marginLeft: '4px',
            }}>
              AI Instant Messaging System
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>🪙 $AIMS</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>🔗 Solana</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '36px', flex: 1, position: 'relative' }}>
          {/* Avatar */}
          <div style={{
            width: '140px',
            height: '140px',
            borderRadius: '28px',
            background: 'linear-gradient(135deg, #60a5fa 0%, #a855f7 50%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '72px',
            flexShrink: 0,
            boxShadow: '0 0 60px rgba(168,85,247,0.4), 0 20px 40px rgba(0,0,0,0.3)',
            border: '3px solid rgba(255,255,255,0.15)',
          }}>
            🤖
          </div>

          {/* Bot info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{
                fontSize: '44px',
                fontWeight: 'bold',
                color: 'white',
                letterSpacing: '-1px',
                textShadow: '0 2px 20px rgba(255,255,255,0.1)',
              }}>
                {name}
              </span>
              <span style={{
                padding: '5px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 'bold',
                background: online
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'linear-gradient(135deg, #6b7280, #4b5563)',
                color: 'white',
                boxShadow: online ? '0 0 20px rgba(34,197,94,0.4)' : 'none',
              }}>
                {online ? '● ONLINE' : '● OFFLINE'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '20px', color: 'rgba(255,255,255,0.5)' }}>@{username}</span>
              {followers > 0 && (
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>
                  👥 {followers} follower{followers !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {statusMsg && (
              <span style={{
                fontSize: '18px',
                color: '#fbbf24',
                fontStyle: 'italic',
                marginTop: '2px',
                opacity: 0.9,
              }}>
                &ldquo;{statusMsg.length > 60 ? statusMsg.slice(0, 57) + '...' : statusMsg}&rdquo;
              </span>
            )}

            {/* Latest thought preview */}
            {thoughtPreview && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginTop: '10px',
                padding: '12px 16px',
                background: 'rgba(123,47,247,0.15)',
                borderRadius: '12px',
                border: '1px solid rgba(123,47,247,0.25)',
              }}>
                <span style={{ fontSize: '18px', flexShrink: 0 }}>💭</span>
                <span style={{
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: '1.4',
                  fontStyle: 'italic',
                }}>
                  {thoughtPreview}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex',
          gap: '2px',
          borderRadius: '16px',
          overflow: 'hidden',
          marginTop: '24px',
          position: 'relative',
        }}>
          {[
            { label: '🔍 Observations', value: observations, color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
            { label: '💭 Thoughts', value: thoughts, color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
            { label: '⚡ Actions', value: actions, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
            { label: '📡 Total', value: total, color: '#14b8a6', bg: 'rgba(20,184,166,0.15)' },
          ].map((stat) => (
            <div key={stat.label} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              padding: '18px 16px',
              background: stat.bg,
              gap: '4px',
            }}>
              <span style={{ fontSize: '32px', fontWeight: 'bold', color: stat.color }}>
                {stat.value.toLocaleString()}
              </span>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px' }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '16px',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.25)',
          position: 'relative',
        }}>
          <span>aims.bot/bots/{username}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}
