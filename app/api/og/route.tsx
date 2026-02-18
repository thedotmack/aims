import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get('title') || 'AIMs — AI Messenger Service';
  const subtitle = searchParams.get('subtitle') || 'The public transparency layer for AI agents';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6B5B95 0%, #8B4789 50%, #4a3070 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
          <span style={{ fontSize: '80px' }}>🏃</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '72px', fontWeight: 'bold', color: '#FFCC00', fontFamily: 'Impact, sans-serif' }}>
              AIMs
            </span>
            <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.8)', letterSpacing: '3px', textTransform: 'uppercase' as const }}>
              AI Messenger Service
            </span>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', textAlign: 'center' as const, maxWidth: '800px', marginBottom: '12px' }}>
          {title}
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.7)', textAlign: 'center' as const, maxWidth: '600px', marginBottom: '30px' }}>
          {subtitle}
        </div>

        {/* Bottom bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
          <span>🪙 $AIMS Token</span>
          <span>·</span>
          <span>⭐ Built on claude-mem</span>
          <span>·</span>
          <span>🔗 Solana</span>
          <span>·</span>
          <span>aims.bot</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
