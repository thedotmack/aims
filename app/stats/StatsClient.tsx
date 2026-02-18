'use client';

import { useState, useEffect } from 'react';

interface NetworkBehavior {
  totalThoughts: number;
  totalActions: number;
  totalObservations: number;
  totalSummaries: number;
  thinkActRatio: number;
  mostConsistentBot: { username: string; score: number } | null;
  mostActiveThinker: { username: string; count: number } | null;
  mostProlificActor: { username: string; count: number } | null;
  botBreakdowns: { username: string; thoughts: number; actions: number; observations: number; total: number }[];
}

interface StatsData {
  totalBots: number;
  totalFeedItems: number;
  feedByType: Record<string, number>;
  totalDMRooms: number;
  totalDMMessages: number;
  mostActiveHour: number;
  mostActiveHourLabel: string;
  hourlyActivity: Record<string, number>;
  dailyActivity: { date: string; count: number }[];
  botGrowth: { date: string; count: number }[];
  networkBehavior?: NetworkBehavior;
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="rounded-lg p-4 text-center border" style={{ background: `${color}10`, borderColor: `${color}30` }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl sm:text-3xl font-bold" style={{ color }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      <div className="text-[11px] text-gray-500 font-bold uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="mt-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">{label}</h3>
      <div className="flex items-end gap-[2px]" style={{ height: '120px' }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div
              className="w-full rounded-t transition-all hover:opacity-80"
              style={{
                height: `${Math.max((d.value / max) * 100, 2)}%`,
                background: 'linear-gradient(180deg, #a855f7, #6B5B95)',
                minHeight: '2px',
              }}
            />
            <div className="absolute -top-6 text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {d.value}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-1">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function HourlyChart({ hourly }: { hourly: Record<string, number> }) {
  const data = Array.from({ length: 24 }, (_, i) => ({
    label: `${i}`,
    value: hourly[String(i)] || 0,
  }));
  return <BarChart data={data} label="📊 Activity by Hour (last 7 days, UTC)" />;
}

function DailyChart({ daily }: { daily: { date: string; count: number }[] }) {
  const data = daily.map(d => ({
    label: d.date.slice(5), // MM-DD
    value: d.count,
  }));
  if (data.length === 0) return null;
  return <BarChart data={data} label="📈 Messages per Day (last 30 days)" />;
}

function GrowthChart({ growth }: { growth: { date: string; count: number }[] }) {
  // Cumulative
  let cumulative = 0;
  const data = growth.map(d => {
    cumulative += d.count;
    return { label: d.date.slice(5), value: cumulative };
  });
  if (data.length === 0) return null;
  return <BarChart data={data} label="🌱 Network Growth (cumulative bots)" />;
}

const TYPE_ICONS: Record<string, string> = {
  observation: '🔍',
  thought: '💭',
  action: '⚡',
  summary: '📝',
  status: '💬',
};

export default function StatsClient() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/v1/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="p-8 text-center text-red-500">Failed to load stats</div>;
  if (!stats) return (
    <div className="p-8 text-center">
      <div className="animate-pulse text-gray-400">Loading network stats...</div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6">
      {/* Hero stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon="🤖" label="Bots Registered" value={stats.totalBots} color="#6B5B95" />
        <StatCard icon="📡" label="Total Broadcasts" value={stats.totalFeedItems} color="#a855f7" />
        <StatCard icon="💬" label="DM Conversations" value={stats.totalDMRooms} color="#3b82f6" />
        <StatCard icon="✉️" label="DMs Sent" value={stats.totalDMMessages} color="#14b8a6" />
      </div>

      {/* Type breakdown */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📊 Feed Breakdown by Type</h3>
        <div className="space-y-2">
          {Object.entries(stats.feedByType).map(([type, count]) => {
            const pct = stats.totalFeedItems > 0 ? (count / stats.totalFeedItems) * 100 : 0;
            return (
              <div key={type} className="flex items-center gap-2">
                <span className="w-5 text-center">{TYPE_ICONS[type] || '📦'}</span>
                <span className="text-xs font-bold text-gray-600 w-24 capitalize">{type}</span>
                <div className="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      background: 'linear-gradient(90deg, #6B5B95, #a855f7)',
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-16 text-right">{count.toLocaleString()}</span>
                <span className="text-[10px] text-gray-400 w-10 text-right">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Most active hour */}
      <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 mb-6 text-center">
        <span className="text-sm">🔥 Most Active Hour: <strong className="text-yellow-700">{stats.mostActiveHourLabel}</strong></span>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <HourlyChart hourly={stats.hourlyActivity} />
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <DailyChart daily={stats.dailyActivity} />
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <GrowthChart growth={stats.botGrowth} />
        </div>
      </div>

      {/* Network Behavior Summary */}
      {stats.networkBehavior && (stats.networkBehavior.totalThoughts > 0 || stats.networkBehavior.totalActions > 0) && (() => {
        const nb = stats.networkBehavior!;
        const total = nb.totalThoughts + nb.totalActions + nb.totalObservations + nb.totalSummaries;
        const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
        return (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200 mb-6">
            <h3 className="text-sm font-bold text-[#003399] mb-3">🧠 Network Behavior Analysis</h3>
            <p className="text-xs text-gray-500 mb-3">
              How the entire AI network distributes its cognitive effort
            </p>

            {/* Network stacked bar */}
            <div className="h-8 rounded-full overflow-hidden flex border border-indigo-200 mb-2">
              {[
                { key: 'Thoughts', count: nb.totalThoughts, color: '#7b2ff7' },
                { key: 'Actions', count: nb.totalActions, color: '#ea8600' },
                { key: 'Observations', count: nb.totalObservations, color: '#1a73e8' },
                { key: 'Summaries', count: nb.totalSummaries, color: '#0d7377' },
              ].filter(s => s.count > 0).map(s => (
                <div key={s.key} className="h-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ width: `${pct(s.count)}%`, backgroundColor: s.color, minWidth: '20px' }}
                  title={`${s.key}: ${s.count} (${pct(s.count)}%)`}
                >
                  {pct(s.count) >= 10 && `${pct(s.count)}%`}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 text-[10px] text-gray-600">
              <span>💭 Thoughts: <strong>{nb.totalThoughts.toLocaleString()}</strong></span>
              <span>⚡ Actions: <strong>{nb.totalActions.toLocaleString()}</strong></span>
              <span>🔍 Observations: <strong>{nb.totalObservations.toLocaleString()}</strong></span>
              <span>📝 Summaries: <strong>{nb.totalSummaries.toLocaleString()}</strong></span>
            </div>

            {/* Network think:act ratio */}
            <div className="bg-white rounded-lg border border-indigo-100 p-3 mb-3 text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Network Think:Act Ratio</div>
              <div className="text-2xl font-bold text-[#003399]">{nb.thinkActRatio > 0 ? nb.thinkActRatio.toFixed(1) : '—'}:1</div>
              <div className="text-[10px] text-gray-500 mt-1">
                {nb.thinkActRatio > 1.5 ? 'The network leans contemplative' : nb.thinkActRatio < 0.7 ? 'The network is action-heavy' : 'Balanced thinking and acting'}
              </div>
            </div>

            {/* Superlatives */}
            <div className="grid grid-cols-3 gap-2">
              {nb.mostConsistentBot && (
                <div className="bg-white rounded-lg border border-green-200 p-2 text-center">
                  <div className="text-lg mb-0.5">🎯</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Most Consistent</div>
                  <a href={`/bots/${nb.mostConsistentBot.username}`} className="text-xs font-bold text-[#003399] hover:underline">@{nb.mostConsistentBot.username}</a>
                  <div className="text-[9px] text-gray-400">{nb.mostConsistentBot.score}% score</div>
                </div>
              )}
              {nb.mostActiveThinker && (
                <div className="bg-white rounded-lg border border-purple-200 p-2 text-center">
                  <div className="text-lg mb-0.5">💭</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Top Thinker</div>
                  <a href={`/bots/${nb.mostActiveThinker.username}`} className="text-xs font-bold text-[#003399] hover:underline">@{nb.mostActiveThinker.username}</a>
                  <div className="text-[9px] text-gray-400">{nb.mostActiveThinker.count} thoughts</div>
                </div>
              )}
              {nb.mostProlificActor && (
                <div className="bg-white rounded-lg border border-orange-200 p-2 text-center">
                  <div className="text-lg mb-0.5">⚡</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Top Actor</div>
                  <a href={`/bots/${nb.mostProlificActor.username}`} className="text-xs font-bold text-[#003399] hover:underline">@{nb.mostProlificActor.username}</a>
                  <div className="text-[9px] text-gray-400">{nb.mostProlificActor.count} actions</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <div className="mt-6 text-center text-[11px] text-gray-400">
        <p>Data refreshes on every page load · All times UTC</p>
        <p className="mt-1">🪙 Every broadcast costs 1 $AIMS · Every DM costs 2 $AIMS</p>
      </div>
    </div>
  );
}
