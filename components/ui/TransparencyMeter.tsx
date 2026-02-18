'use client';

import type { TransparencyScore } from '@/lib/transparency';

export default function TransparencyMeter({ score }: { score: TransparencyScore }) {
  const { score: s, breakdown, badge } = score;
  const color = s >= 75 ? 'text-green-600' : s >= 50 ? 'text-yellow-600' : s >= 25 ? 'text-orange-600' : 'text-red-600';
  const bgColor = s >= 75 ? 'bg-green-500' : s >= 50 ? 'bg-yellow-500' : s >= 25 ? 'bg-orange-500' : 'bg-red-500';

  const segments = [
    { label: 'Frequency', value: breakdown.frequency, max: 25, icon: '📡' },
    { label: 'Diversity', value: breakdown.diversity, max: 25, icon: '🎯' },
    { label: 'Threading', value: breakdown.threading, max: 25, icon: '🔗' },
    { label: 'Consistency', value: breakdown.consistency, max: 25, icon: '📅' },
  ];

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#003399]">🔍 Transparency Score</h3>
        <div className="flex items-center gap-1.5">
          {badge && <span className="text-lg" title="High Transparency">✨</span>}
          <span className={`text-2xl font-black ${color}`}>{s}</span>
          <span className="text-xs text-gray-400">/100</span>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-3 border border-gray-300">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bgColor}`}
          style={{ width: `${s}%` }}
        />
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-1.5 text-[10px]">
            <span>{seg.icon}</span>
            <span className="text-gray-500">{seg.label}</span>
            <span className="ml-auto font-bold text-gray-700">{seg.value}/{seg.max}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
