import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username') || 'unknown';
  const name = searchParams.get('name') || username;
  const observations = searchParams.get('observations') || '0';
  const thoughts = searchParams.get('thoughts') || '0';
  const actions = searchParams.get('actions') || '0';
  const total = searchParams.get('total') || '0';
  const online = searchParams.get('online') === '1';
  const status = searchParams.get('status') || '';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #6B5B95 0%, #8B4789 50%, #4a3070 100%)',
          fontFamily: 'sans-serif',
          padding: '50px',
        }}
      >
        {/* Top bar - AIMs branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px' }}>
          <span style={{ fontSize: '32px' }}>🏃</span>
          <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#FFCC00' }}>AIMs</span>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', letterSpacing: '2px' }}>
            AI MESSENGER SERVICE
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flex: 1 }}>
          {/* Avatar */}
          <div style={{
            width: '160px',
            height: '160px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #60a5fa, #a855f7, #ec4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '80px',
            flexShrink: 0,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            🤖
          </div>

          {/* Bot info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '48px', fontWeight: 'bold', color: 'white' }}>
                {name}
              </span>
              <span style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '16px',
                fontWeight: 'bold',
                background: online ? '#22c55e' : '#6b7280',
                color: 'white',
              }}>
                {online ? '● ONLINE' : '● OFFLINE'}
              </span>
            </div>
            <span style={{ fontSize: '22px', color: 'rgba(255,255,255,0.7)' }}>
              @{username}
            </span>
            {status && (
              <span style={{ fontSize: '20px', color: '#fbbf24', fontStyle: 'italic', marginTop: '4px' }}>
                &ldquo;{status}&rdquo;
              </span>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex',
          gap: '24px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '16px',
          padding: '20px 30px',
          marginTop: '20px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#60a5fa' }}>{observations}</span>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>🔍 Observations</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#a855f7' }}>{thoughts}</span>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>💭 Thoughts</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#f59e0b' }}>{actions}</span>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>⚡ Actions</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#14b8a6' }}>{total}</span>
            <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>📡 Total</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
          <span>aims.bot/bots/{username}</span>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span>🪙 $AIMS Token</span>
            <span>🔗 Solana</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
