'use client';

import type { BehaviorTrend } from '@/lib/behavior-analysis';

const LINES = [
  { key: 'thought' as const, color: '#7b2ff7', label: '💭 Thoughts' },
  { key: 'action' as const, color: '#ea8600', label: '⚡ Actions' },
  { key: 'observation' as const, color: '#1a73e8', label: '🔍 Observations' },
];

export default function BehaviorTrendsChart({ data }: { data: BehaviorTrend[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="text-3xl block mb-2">📈</span>
        <p className="text-gray-500 text-sm">No behavior data in the last 30 days.</p>
      </div>
    );
  }

  const W = 600;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxVal = Math.max(...data.flatMap(d => [d.thought, d.action, d.observation]), 1);
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  function toPath(key: 'thought' | 'action' | 'observation'): string {
    return data.map((d, i) => {
      const x = PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
      const y = PAD.top + chartH - (d[key] / maxVal) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // Show ~5 date labels
  const labelInterval = Math.max(1, Math.floor(data.length / 5));

  return (
    <div>
      <h3 className="font-bold text-sm text-[#003399] mb-2">📈 Behavior Trends (30 Days)</h3>
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid lines */}
          {yTicks.map(tick => {
            const y = PAD.top + chartH - (tick / maxVal) * chartH;
            return (
              <g key={tick}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize="10">{tick}</text>
              </g>
            );
          })}

          {/* Date labels */}
          {data.map((d, i) => {
            if (i % labelInterval !== 0 && i !== data.length - 1) return null;
            const x = PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
            return (
              <text key={d.date} x={x} y={H - 5} textAnchor="middle" fill="#9ca3af" fontSize="9">
                {d.date.slice(5)}
              </text>
            );
          })}

          {/* Lines */}
          {LINES.map(line => (
            <path
              key={line.key}
              d={toPath(line.key)}
              fill="none"
              stroke={line.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Dots on each data point */}
          {LINES.map(line =>
            data.map((d, i) => {
              if (d[line.key] === 0) return null;
              const x = PAD.left + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2);
              const y = PAD.top + chartH - (d[line.key] / maxVal) * chartH;
              return (
                <circle key={`${line.key}-${i}`} cx={x} cy={y} r="3" fill={line.color} opacity="0.7">
                  <title>{d.date}: {d[line.key]} {line.key}s</title>
                </circle>
              );
            })
          )}
        </svg>

        {/* Legend */}
        <div className="flex justify-center gap-4 mt-2">
          {LINES.map(line => (
            <div key={line.key} className="flex items-center gap-1.5 text-[10px] text-gray-600">
              <span className="inline-block w-3 h-1 rounded" style={{ backgroundColor: line.color }} />
              {line.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
