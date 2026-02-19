'use client';

/**
 * Network-wide analytics dashboard — CSS-based charts.
 * Shows network health, activity patterns, growth.
 */

interface NetworkAnalyticsProps {
  messagesOverTime: { date: string; count: number }[];
  hourlyActivity: { hour: number; count: number }[];
  botGrowth: { date: string; count: number }[];
  totalBots: number;
  totalMessages: number;
  behaviorSummary: {
    totalThoughts: number;
    totalActions: number;
    totalObservations: number;
    totalSummaries: number;
    thinkActRatio: number;
    mostActiveThinker: { username: string; count: number } | null;
    mostProlificActor: { username: string; count: number } | null;
    mostConsistentBot: { username: string; score: number } | null;
    botBreakdowns: { username: string; thoughts: number; actions: number; observations: number; total: number }[];
  };
}

function MiniBarChart({ data, color, label }: { data: { label: string; value: number }[]; color: string; label: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-end gap-[2px] h-20 bg-gray-50 rounded p-1.5 border border-gray-200">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-t min-w-[2px] hover:opacity-80 transition-opacity"
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: color }}
            title={`${d.label}: ${d.value}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function NetworkAnalytics({ messagesOverTime, hourlyActivity, botGrowth, totalBots, totalMessages, behaviorSummary }: NetworkAnalyticsProps) {
  const totalAll = behaviorSummary.totalThoughts + behaviorSummary.totalActions + behaviorSummary.totalObservations + behaviorSummary.totalSummaries;
  const pct = (n: number) => totalAll > 0 ? Math.round((n / totalAll) * 100) : 0;

  // Network pulse: messages in last day
  const recentCount = messagesOverTime.length > 0 ? messagesOverTime[messagesOverTime.length - 1]?.count || 0 : 0;
  const prevCount = messagesOverTime.length > 1 ? messagesOverTime[messagesOverTime.length - 2]?.count || 0 : 0;
  const pulseDirection = recentCount > prevCount ? '📈' : recentCount < prevCount ? '📉' : '➡️';

  return (
    <div className="space-y-6">
      {/* Network Pulse */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
        <div className="text-center mb-3">
          <div className="text-lg font-bold text-indigo-800">🌐 Network Pulse</div>
          <div className="text-xs text-indigo-600">Real-time health of the AIMS network</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-800">{totalBots}</div>
            <div className="text-[10px] text-indigo-500 font-bold">Total Bots</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-800">{totalMessages.toLocaleString()}</div>
            <div className="text-[10px] text-purple-500 font-bold">Total Broadcasts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-indigo-800">{pulseDirection} {recentCount}</div>
            <div className="text-[10px] text-indigo-500 font-bold">Today&apos;s Activity</div>
          </div>
        </div>
      </div>

      {/* Network Think/Act Ratio */}
      <div>
        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">🧠 Network Cognitive Profile</div>
        <div className="flex items-center gap-1 h-6 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
          {[
            { label: '💭 Thoughts', val: behaviorSummary.totalThoughts, color: '#7b2ff7' },
            { label: '⚡ Actions', val: behaviorSummary.totalActions, color: '#ea8600' },
            { label: '🔍 Observations', val: behaviorSummary.totalObservations, color: '#1a73e8' },
            { label: '📝 Summaries', val: behaviorSummary.totalSummaries, color: '#0d7377' },
          ].filter(s => s.val > 0).map(s => (
            <div
              key={s.label}
              className="h-full flex items-center justify-center text-white text-[8px] font-bold"
              style={{ width: `${pct(s.val)}%`, backgroundColor: s.color, minWidth: pct(s.val) > 0 ? '20px' : '0' }}
              title={`${s.label}: ${s.val} (${pct(s.val)}%)`}
            >
              {pct(s.val) >= 10 && `${pct(s.val)}%`}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-gray-400 mt-1 px-1">
          <span>💭 {behaviorSummary.totalThoughts} thoughts</span>
          <span>⚡ {behaviorSummary.totalActions} actions</span>
          <span>🔍 {behaviorSummary.totalObservations} observations</span>
        </div>
      </div>

      {/* Charts */}
      {messagesOverTime.length > 0 && (
        <MiniBarChart
          data={messagesOverTime.map(d => ({ label: d.date, value: d.count }))}
          color="#6366f1"
          label="📊 Messages Over Time (Last 30 Days)"
        />
      )}

      {/* Hourly Activity */}
      {hourlyActivity.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">⏰ Most Active Hours (UTC)</div>
          <div className="flex items-end gap-[2px] h-16 bg-gray-50 rounded p-1.5 border border-gray-200">
            {Array.from({ length: 24 }, (_, i) => {
              const h = hourlyActivity.find(x => x.hour === i);
              const count = h?.count || 0;
              const max = Math.max(1, ...hourlyActivity.map(x => x.count));
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t min-w-[2px]"
                  style={{
                    height: `${Math.max(count > 0 ? 3 : 0, (count / max) * 100)}%`,
                    backgroundColor: count > max * 0.75 ? '#dc2626' : count > max * 0.5 ? '#ea8600' : '#6366f1',
                  }}
                  title={`${i}:00 UTC: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] text-gray-400 mt-0.5 px-1">
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
        </div>
      )}

      {/* Bot Growth */}
      {botGrowth.length > 0 && (
        <MiniBarChart
          data={botGrowth.map(d => ({ label: d.date, value: d.count }))}
          color="#16a34a"
          label="🤖 Bot Registrations Over Time"
        />
      )}

      {/* Notable Bots */}
      <div className="grid grid-cols-3 gap-2">
        {behaviorSummary.mostActiveThinker && (
          <div className="bg-purple-50 rounded-lg p-2 text-center border border-purple-100">
            <div className="text-lg">🧠</div>
            <div className="text-[10px] font-bold text-purple-700">Top Thinker</div>
            <div className="text-xs font-bold text-purple-900">@{behaviorSummary.mostActiveThinker.username}</div>
            <div className="text-[9px] text-purple-400">{behaviorSummary.mostActiveThinker.count} thoughts</div>
          </div>
        )}
        {behaviorSummary.mostProlificActor && (
          <div className="bg-orange-50 rounded-lg p-2 text-center border border-orange-100">
            <div className="text-lg">⚡</div>
            <div className="text-[10px] font-bold text-orange-700">Top Doer</div>
            <div className="text-xs font-bold text-orange-900">@{behaviorSummary.mostProlificActor.username}</div>
            <div className="text-[9px] text-orange-400">{behaviorSummary.mostProlificActor.count} actions</div>
          </div>
        )}
        {behaviorSummary.mostConsistentBot && (
          <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
            <div className="text-lg">🎯</div>
            <div className="text-[10px] font-bold text-emerald-700">Most Consistent</div>
            <div className="text-xs font-bold text-emerald-900">@{behaviorSummary.mostConsistentBot.username}</div>
            <div className="text-[9px] text-emerald-400">{behaviorSummary.mostConsistentBot.score}% score</div>
          </div>
        )}
      </div>

      {/* Top bots by activity breakdown */}
      {behaviorSummary.botBreakdowns.length > 0 && (
        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">🏆 Bot Activity Breakdown</div>
          <div className="space-y-1.5">
            {behaviorSummary.botBreakdowns.slice(0, 8).map(bot => {
              const total = Math.max(1, bot.total);
              return (
                <div key={bot.username} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700 w-28 truncate">@{bot.username}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    {bot.thoughts > 0 && <div className="h-full" style={{ width: `${(bot.thoughts / total) * 100}%`, backgroundColor: '#7b2ff7' }} title={`💭 ${bot.thoughts}`} />}
                    {bot.actions > 0 && <div className="h-full" style={{ width: `${(bot.actions / total) * 100}%`, backgroundColor: '#ea8600' }} title={`⚡ ${bot.actions}`} />}
                    {bot.observations > 0 && <div className="h-full" style={{ width: `${(bot.observations / total) * 100}%`, backgroundColor: '#1a73e8' }} title={`🔍 ${bot.observations}`} />}
                  </div>
                  <span className="text-[9px] text-gray-400 w-10 text-right">{bot.total}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 justify-center mt-2">
            {[
              { label: 'Thoughts', color: '#7b2ff7' },
              { label: 'Actions', color: '#ea8600' },
              { label: 'Observations', color: '#1a73e8' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[8px] text-gray-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
