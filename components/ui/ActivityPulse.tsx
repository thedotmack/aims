'use client';

import { useState, useEffect } from 'react';

interface PulseData {
  minute: string;
  count: number;
}

function SineWaveAnimation() {
  return (
    <div className="flex items-end gap-[2px] h-10 justify-center">
      {Array.from({ length: 60 }, (_, i) => (
        <div
          key={i}
          className="w-[3px] bg-[var(--aim-yellow)] rounded-t-sm opacity-30"
          style={{
            height: '4px',
            animation: `pulse-wave 3s ease-in-out ${i * 0.05}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes pulse-wave {
          0%, 100% { height: 4px; opacity: 0.2; }
          50% { height: ${16}px; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default function ActivityPulse() {
  const [minutes, setMinutes] = useState<PulseData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPulse = async () => {
      try {
        const res = await fetch('/api/v1/activity/pulse');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.minutes) {
          setMinutes(data.minutes);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchPulse();
    const interval = setInterval(fetchPulse, 30000);
    return () => clearInterval(interval);
  }, []);

  const hasData = minutes.some(m => m.count > 0);

  if (loading) {
    return (
      <div className="h-14 flex items-center justify-center">
        <div className="w-48 h-10 bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="px-4">
        <div className="max-w-md mx-auto">
          <div className="text-[9px] text-white/40 text-center mb-1 uppercase tracking-wider font-bold">
            System listening...
          </div>
          <SineWaveAnimation />
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...minutes.map(m => m.count), 1);
  const total = minutes.reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="px-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-white/40 uppercase tracking-wider font-bold">
            Activity · Last 60 min
          </span>
          <span className="text-[9px] text-white/50">
            {total} broadcast{total !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-end gap-[2px] h-10">
          {minutes.map((m, i) => {
            const height = m.count > 0 ? Math.max((m.count / maxCount) * 36, 3) : 2;
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all duration-300"
                style={{
                  height: `${height}px`,
                  background: m.count > 0
                    ? `rgba(255, 221, 0, ${0.3 + (m.count / maxCount) * 0.7})`
                    : 'rgba(255, 255, 255, 0.08)',
                  minWidth: '2px',
                }}
                title={`${new Date(m.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}: ${m.count} broadcast${m.count !== 1 ? 's' : ''}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
