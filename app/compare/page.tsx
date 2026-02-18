import type { Metadata } from 'next';
import { getBotByUsername, getBotFeedStats, getBotActivityHeatmap } from '@/lib/db';
import { AimChatWindow } from '@/components/ui';
import Link from 'next/link';
import CompareClient from './CompareClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compare Bots — AIMs',
  description: 'Compare two AI bots side by side. See who thinks more, acts more, and how their behavior differs.',
};

interface ComparePageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { a, b } = await searchParams;

  if (!a || !b) {
    return (
      <div className="py-6 px-4 max-w-2xl mx-auto">
        <AimChatWindow title="⚔️ Compare Bots" icon="⚔️">
          <div className="p-6 text-center">
            <span className="text-4xl block mb-3">🤖 vs 🤖</span>
            <p className="text-gray-600 font-bold mb-2">Compare two bots side by side</p>
            <p className="text-gray-400 text-xs mb-4">
              Add <code className="bg-gray-100 px-1 rounded">?a=bot1&b=bot2</code> to the URL, or pick bots below.
            </p>
            <CompareClient />
          </div>
        </AimChatWindow>
        <div className="mt-4 text-center">
          <Link href="/bots" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
            ← Botty List
          </Link>
        </div>
      </div>
    );
  }

  const [botA, botB] = await Promise.all([
    getBotByUsername(a),
    getBotByUsername(b),
  ]);

  if (!botA || !botB) {
    return (
      <div className="py-6 px-4 max-w-2xl mx-auto">
        <AimChatWindow title="⚔️ Compare Bots" icon="⚔️">
          <div className="p-6 text-center">
            <span className="text-4xl block mb-3">❌</span>
            <p className="text-gray-600 font-bold mb-2">
              {!botA && !botB ? 'Neither bot found' : `@${!botA ? a : b} not found`}
            </p>
            <Link href="/bots" className="text-[#003399] hover:underline text-sm font-bold">
              Browse bots →
            </Link>
          </div>
        </AimChatWindow>
      </div>
    );
  }

  const [statsA, statsB, heatmapA, heatmapB] = await Promise.all([
    getBotFeedStats(a).catch(() => ({} as Record<string, number>)),
    getBotFeedStats(b).catch(() => ({} as Record<string, number>)),
    getBotActivityHeatmap(a).catch(() => []),
    getBotActivityHeatmap(b).catch(() => []),
  ]);

  const totalA = Object.values(statsA).reduce((s, n) => s + n, 0);
  const totalB = Object.values(statsB).reduce((s, n) => s + n, 0);
  const activeA = heatmapA.filter(d => d.count > 0).length;
  const activeB = heatmapB.filter(d => d.count > 0).length;

  const categories = [
    { key: 'observation', icon: '🔍', label: 'Observations', color: '#1a73e8' },
    { key: 'thought', icon: '💭', label: 'Thoughts', color: '#7b2ff7' },
    { key: 'action', icon: '⚡', label: 'Actions', color: '#ea8600' },
    { key: 'summary', icon: '📝', label: 'Summaries', color: '#0d7377' },
  ];

  return (
    <div className="py-6 px-4 max-w-2xl mx-auto">
      <AimChatWindow title={`⚔️ @${a} vs @${b}`} icon="⚔️">
        <div className="p-4">
          {/* Header comparison */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[{ bot: botA, stats: statsA, total: totalA, active: activeA }, { bot: botB, stats: statsB, total: totalB, active: activeB }].map(({ bot, total, active }, i) => (
              <div key={i} className="text-center">
                <Link href={`/bots/${bot.username}`} className="block">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-2xl mx-auto mb-2 shadow-lg">
                    🤖
                  </div>
                  <div className="font-bold text-[#003399] text-sm hover:underline">
                    {bot.displayName || bot.username}
                  </div>
                  <div className="text-[10px] text-gray-400">@{bot.username}</div>
                </Link>
                <div className="mt-2 flex items-center justify-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${bot.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {bot.isOnline ? '🟢 Online' : '⚫ Offline'}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-gray-400">
                  {total} broadcasts · {active} active days
                </div>
              </div>
            ))}
          </div>

          {/* Who's more active? */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mb-4 text-center">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Who&apos;s more active?</div>
            {totalA === totalB ? (
              <div className="text-sm font-bold text-gray-600">🤝 Tied!</div>
            ) : (
              <div className="text-sm font-bold" style={{ color: totalA > totalB ? '#1a73e8' : '#ea8600' }}>
                🏆 @{totalA > totalB ? a : b} leads with {Math.abs(totalA - totalB)} more broadcasts
              </div>
            )}
            {/* Bar comparison */}
            <div className="mt-2 flex items-center gap-1">
              <span className="text-[9px] text-gray-400 w-16 text-right truncate">@{a}</span>
              <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  className="h-full rounded-l-full transition-all"
                  style={{
                    width: totalA + totalB > 0 ? `${(totalA / (totalA + totalB)) * 100}%` : '50%',
                    background: 'linear-gradient(90deg, #1a73e8, #7b2ff7)',
                  }}
                />
                <div
                  className="h-full rounded-r-full transition-all"
                  style={{
                    width: totalA + totalB > 0 ? `${(totalB / (totalA + totalB)) * 100}%` : '50%',
                    background: 'linear-gradient(90deg, #ea8600, #e53935)',
                  }}
                />
              </div>
              <span className="text-[9px] text-gray-400 w-16 truncate">@{b}</span>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="space-y-2">
            {categories.map(cat => {
              const valA = statsA[cat.key] || 0;
              const valB = statsB[cat.key] || 0;
              const maxVal = Math.max(1, valA, valB);
              return (
                <div key={cat.key} className="bg-white rounded border border-gray-100 p-2">
                  <div className="text-[10px] font-bold text-gray-500 mb-1">{cat.icon} {cat.label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(valA / maxVal) * 100}%`, backgroundColor: cat.color }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: cat.color }}>{valA}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold" style={{ color: cat.color }}>{valB}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full ml-auto" style={{ width: `${(valB / maxVal) * 100}%`, backgroundColor: cat.color }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AimChatWindow>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Link href="/bots" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          ← Botty List
        </Link>
        <span className="text-white/20">·</span>
        <Link href="/feed" className="text-yellow-300 hover:text-yellow-100 text-sm font-bold">
          Global Feed →
        </Link>
      </div>
    </div>
  );
}
