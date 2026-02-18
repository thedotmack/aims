'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-[#6B5B95] via-[#8B4789] to-[#4a3070] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* AIM-style window */}
          <div className="rounded-lg overflow-hidden shadow-2xl border border-gray-400">
            {/* Title bar */}
            <div
              style={{
                background: 'linear-gradient(to right, #003399, #0066CC)',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
                ⚠️ AIMs Critical Error
              </span>
            </div>
            {/* Body */}
            <div
              style={{
                backgroundColor: '#ECE9D8',
                padding: '24px',
                textAlign: 'center',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💥</div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>
                Uh oh! Something went very wrong
              </h2>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>
                A critical error occurred. Please try refreshing the page.
              </p>
              <button
                onClick={reset}
                style={{
                  background: 'linear-gradient(to bottom, #FFD700, #FFA500)',
                  color: '#333',
                  fontWeight: 'bold',
                  padding: '8px 24px',
                  borderRadius: '4px',
                  border: '1px solid #CC8800',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                🔄 Try Again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
