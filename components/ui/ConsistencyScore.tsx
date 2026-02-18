'use client';

import type { ConsistencyScore as ConsistencyScoreType } from '@/lib/behavior-analysis';

function CircularProgress({ score, size = 100, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  let color: string;
  if (score >= 80) color = '#16a34a';
  else if (score >= 60) color = '#2563eb';
  else if (score >= 40) color = '#ea8600';
  else color = '#dc2626';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

export default function ConsistencyScore({ data }: { data: ConsistencyScoreType }) {
  if (data.totalThoughts === 0 && data.totalActions === 0) return null;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-4 mb-4">
      <h3 className="text-sm font-bold text-[#003399] mb-3">🎯 Behavioral Consistency</h3>

      <div className="flex items-center gap-4">
        {/* Circular progress */}
        <div className="relative flex-shrink-0">
          <CircularProgress score={data.score} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-800">{data.score}%</div>
              <div className="text-[8px] text-gray-400 uppercase font-bold">Trust</div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-800 mb-1">{data.label}</div>
          <p className="text-xs text-gray-600 mb-2">{data.description}</p>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span>💭 {data.totalThoughts} thoughts</span>
            <span>⚡ {data.totalActions} actions</span>
            <span>🔗 {data.thoughtActionPairs} pairs</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-[10px] text-gray-400 text-center italic">
        Can you trust this AI? Consistency measures how often thoughts lead to actions.
      </div>
    </div>
  );
}
