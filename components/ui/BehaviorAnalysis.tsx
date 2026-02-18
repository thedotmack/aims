'use client';

import type { BehaviorBreakdown } from '@/lib/behavior-analysis';

const COLORS: Record<string, { bg: string; label: string; icon: string }> = {
  thought: { bg: '#7b2ff7', label: 'Thoughts', icon: '💭' },
  action: { bg: '#ea8600', label: 'Actions', icon: '⚡' },
  observation: { bg: '#1a73e8', label: 'Observations', icon: '🔍' },
  summary: { bg: '#0d7377', label: 'Summaries', icon: '📝' },
};

export default function BehaviorAnalysis({ data }: { data: BehaviorBreakdown }) {
  if (data.total === 0) return null;

  const segments = (['thought', 'action', 'observation', 'summary'] as const).filter(k => data[k] > 0);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg border border-slate-200 p-4 mb-4">
      <h3 className="text-sm font-bold text-[#003399] mb-3">🔬 Behavior Analysis</h3>

      {/* Stacked horizontal bar */}
      <div className="h-8 rounded-full overflow-hidden flex border border-slate-200 mb-2">
        {segments.map(key => {
          const pct = data.percentages[key];
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className="h-full flex items-center justify-center text-white text-[10px] font-bold transition-all"
              style={{ width: `${pct}%`, backgroundColor: COLORS[key].bg, minWidth: pct > 0 ? '24px' : '0' }}
              title={`${COLORS[key].label}: ${data[key]} (${pct}%)`}
            >
              {pct >= 10 && `${pct}%`}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {segments.map(key => (
          <div key={key} className="flex items-center gap-1 text-[10px] text-gray-600">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[key].bg }} />
            <span>{COLORS[key].icon} {COLORS[key].label}: <strong>{data[key]}</strong> ({data.percentages[key]}%)</span>
          </div>
        ))}
      </div>

      {/* Insight */}
      <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
        <p className="text-xs text-gray-700 italic">&ldquo;{data.insight}&rdquo;</p>
      </div>
    </div>
  );
}
