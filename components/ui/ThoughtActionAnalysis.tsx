'use client';

import type { ThoughtActionAnalysis } from '@/lib/thought-analysis';

function Bar({ label, percent, color, networkAvg }: { label: string; percent: number; color: string; networkAvg: number }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] font-bold mb-0.5">
        <span>{label}</span>
        <span>{percent}% <span className="text-gray-400 font-normal">(network avg: {networkAvg}%)</span></span>
      </div>
      <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percent}%` }}
        />
        {/* Network average marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-400 opacity-60"
          style={{ left: `${networkAvg}%` }}
          title={`Network average: ${networkAvg}%`}
        />
      </div>
    </div>
  );
}

function TrendChart({ trend }: { trend: ThoughtActionAnalysis['trend'] }) {
  if (trend.length === 0) return <p className="text-[10px] text-gray-400 italic">No activity in the last 7 days</p>;

  const maxVal = Math.max(...trend.flatMap(d => [d.thoughts, d.actions, d.observations]), 1);

  return (
    <div className="mt-3">
      <p className="text-[10px] font-bold text-gray-500 mb-1">7-DAY TREND</p>
      <div className="flex items-end gap-1 h-16">
        {trend.map((day) => {
          const tH = (day.thoughts / maxVal) * 100;
          const aH = (day.actions / maxVal) * 100;
          const oH = (day.observations / maxVal) * 100;
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${day.date}: ${day.thoughts}T ${day.actions}A ${day.observations}O`}>
              <div className="w-full flex gap-px items-end" style={{ height: '48px' }}>
                <div className="flex-1 bg-purple-400 rounded-t" style={{ height: `${Math.max(tH, 2)}%` }} />
                <div className="flex-1 bg-orange-400 rounded-t" style={{ height: `${Math.max(aH, 2)}%` }} />
                <div className="flex-1 bg-blue-400 rounded-t" style={{ height: `${Math.max(oH, 2)}%` }} />
              </div>
              <span className="text-[7px] text-gray-400">{day.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-1 text-[8px] text-gray-400">
        <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 bg-purple-400 rounded-sm" /> Thoughts</span>
        <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 bg-orange-400 rounded-sm" /> Actions</span>
        <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 bg-blue-400 rounded-sm" /> Observations</span>
      </div>
    </div>
  );
}

export default function ThoughtActionAnalysisView({ data }: { data: ThoughtActionAnalysis }) {
  if (data.total === 0) return null;

  const ratio = data.thoughts > 0 && data.actions > 0
    ? (data.thoughts / data.actions).toFixed(1)
    : data.thoughts > 0 ? '∞' : '0';

  const label = Number(ratio) > 1.5 ? '🧠 Deep Thinker' : Number(ratio) < 0.7 ? '⚡ Action Machine' : '⚖️ Balanced';

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#003399]">🧠 Thinking vs Acting</h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700">
          {label} — {ratio}:1 ratio
        </span>
      </div>

      <Bar label="💭 Thoughts" percent={data.thoughtPercent} color="bg-purple-500" networkAvg={data.networkAvg.thoughtPercent} />
      <Bar label="⚡ Actions" percent={data.actionPercent} color="bg-orange-500" networkAvg={data.networkAvg.actionPercent} />
      <Bar label="🔍 Observations" percent={data.observationPercent} color="bg-blue-500" networkAvg={data.networkAvg.observationPercent} />

      <TrendChart trend={data.trend} />
    </div>
  );
}
