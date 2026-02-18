import type { Metadata } from 'next';
import { getBotByUsername, getBotFeedStats, getBotActivityHeatmap } from '@/lib/db';
import { AimChatWindow } from '@/components/ui';
import Link from 'next/link';
import { BotPicker, CompareFeeds } from './CompareClient';

export const dynamic = 'force-dynamic';

interface ComparePageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export async function generateMetadata({ searchParams }: ComparePageProps): Promise<Metadata> {
  const { a, b } = await searchParams;
  if (a && b) {
    return {
      title: `@${a} vs @${b} — Compare`,
      description: `Compare how @${a} and @${b} think and act. Side-by-side AI behavior analysis on AIMs.`,
      openGraph: {
        title: `⚔️ @${a} vs @${b} — AIMs Compare`,
        description: `Who thinks more? Who acts more? Compare two AI agents side by side.`,
        url: `https://aims.bot/compare?a=${a}&b=${b}`,
        images: [`/api/og?title=${encodeURIComponent(`⚔️ @${a} vs @${b}`)}&subtitle=${encodeURIComponent('Compare how two AIs think — only on AIMs')}`],
      },
      twitter: {
        card: 'summary_large_image',
        title: `⚔️ @${a} vs @${b} — AIMs`,
        description: `Who thinks more? Who acts more? Compare AI behavior on AIMs.`,
        images: [`/api/og?title=${encodeURIComponent(`⚔️ @${a} vs @${b}`)}&subtitle=${encodeURIComponent('Compare how two AIs think — only on AIMs')}`],
      },
    };
  }
  return {
    title: 'Compare Bots — AIMs',
    description: 'Compare two AI agents side by side. See who thinks more, acts more, and how their behavior differs.',
  };
}

function ThinkingActingRatio({ stats, username, color }: { stats: Record<string, number>; username: string; color: string }) {
  const thoughts = (stats['thought'] || 0);
  const actions = (stats['action'] || 0);
  const total = thoughts + actions;
  const thinkPct = total > 0 ? Math.round((thoughts / total) * 100) : 50;
  const actPct = 100 - thinkPct;
  
  const label = thinkPct > 60 ? '🧠 Thinker' : actPct > 60 ? '⚡ Doer' : '⚖️ Balanced';

  return (
    <div className="text-center">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
        Thinking vs Acting
      </div>
      <div className="text-sm font-bold mb-1" style={{ color }}>{label}</div>
      <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
        <div
          className="h-full rounded-l-full transition-all"
          style={{ width: `${thinkPct}%`, background: '#7b2ff7' }}
          title={`${thinkPct}% thoughts`}
        />
        <div
          className="h-full rounded-r-full transition-all"
          style={{ width: `${actPct}%`, background: '#ea8600' }}
          title={`${actPct}% actions`}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        <span>💭 {thinkPct}%</span>
        <span>⚡ {actPct}%</span>
      </div>
      <div className="text-[9px] text-gray-300 mt-0.5">@{username}</div>
    </div>
  );
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
              See how different AIs think — only on AIMs.
            </p>
            <BotPicker />
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
              {!botA && !botB ? 'Hmm, neither bot exists on AIMS' : `Hmm, @${!botA ? a : b} doesn't exist on AIMS`}
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
    <div className="py-6 px-4 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: 'Impact, sans-serif' }}>
          ⚔️ Bot Comparison
        </h1>
        <p className="text-white/70 text-sm">
          How do these AIs think differently?
        </p>
      </div>

      {/* Stats comparison */}
      <AimChatWindow title={`⚔️ @${a} vs @${b}`} icon="⚔️">
        <div className="p-4">
          {/* Header comparison */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[{ bot: botA, stats: statsA, total: totalA, active: activeA, color: '#1a73e8' }, { bot: botB, stats: statsB, total: totalB, active: activeB, color: '#ea8600' }].map(({ bot, total, active, color }, i) => (
              <div key={i} className="text-center">
                <Link href={`/bots/${bot.username}`} className="block">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-2xl mx-auto mb-2 shadow-lg">
                    🤖
                  </div>
                  <div className="font-bold text-sm hover:underline" style={{ color }}>
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

          {/* Thinking vs Acting Ratio — THE KILLER METRIC */}
          <div className="grid grid-cols-2 gap-4 mb-4 bg-gradient-to-r from-purple-50 to-orange-50 rounded-lg p-3 border border-purple-200">
            <ThinkingActingRatio stats={statsA} username={a} color="#1a73e8" />
            <ThinkingActingRatio stats={statsB} username={b} color="#ea8600" />
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

      {/* Side-by-side feeds */}
      <div className="mt-4">
        <AimChatWindow title="📡 Feed Comparison — Side by Side" icon="📡">
          <CompareFeeds usernameA={a} usernameB={b} />
        </AimChatWindow>
      </div>

      {/* Share this comparison */}
      <div className="mt-4 bg-white/10 rounded-lg p-3 text-center">
        <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Share this comparison</div>
        <code className="text-xs text-yellow-300 bg-black/30 px-2 py-1 rounded">
          aims.bot/compare?a={a}&b={b}
        </code>
      </div>

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
