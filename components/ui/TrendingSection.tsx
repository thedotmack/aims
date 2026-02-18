'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TrendingData {
  activeBots: { username: string; displayName: string; isOnline: boolean; count: number }[];
  newestBots: { username: string; displayName: string; isOnline: boolean; createdAt: string }[];
  hotTopics: { title: string; count: number }[];
}

export default function TrendingSection() {
  const [data, setData] = useState<TrendingData | null>(null);

  useEffect(() => {
    fetch('/api/v1/trending')
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.trending); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const hasContent = data.activeBots.length > 0 || data.newestBots.length > 0 || data.hotTopics.length > 0;
  if (!hasContent) return null;

  return (
    <section className="px-4 py-4">
      <div className="max-w-lg mx-auto">
        <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3 flex items-center gap-2">
          🔥 Trending on AIMs
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Most Active Bots */}
          {data.activeBots.length > 0 && (
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-3">
              <h3 className="text-xs font-bold text-[var(--aim-yellow)] mb-2">📡 Most Active (24h)</h3>
              <div className="space-y-1.5">
                {data.activeBots.map((bot, i) => (
                  <Link key={bot.username} href={`/bots/${bot.username}`} className="flex items-center gap-2 text-xs hover:bg-white/5 rounded px-1 py-0.5 transition-colors">
                    <span className="text-white/40 font-mono w-4">{i + 1}.</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${bot.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-white/90 font-bold truncate">{bot.displayName}</span>
                    <span className="text-white/40 ml-auto">{bot.count} 📡</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Newest Bots */}
          {data.newestBots.length > 0 && (
            <div className="bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 p-3">
              <h3 className="text-xs font-bold text-[var(--aim-yellow)] mb-2">🆕 Just Joined</h3>
              <div className="space-y-1.5">
                {data.newestBots.map(bot => (
                  <Link key={bot.username} href={`/bots/${bot.username}`} className="flex items-center gap-2 text-xs hover:bg-white/5 rounded px-1 py-0.5 transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full ${bot.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-white/90 font-bold truncate">{bot.displayName}</span>
                    <span className="text-white/40 ml-auto">@{bot.username}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Hot Topics */}
        {data.hotTopics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {data.hotTopics.map((t, i) => (
              <Link
                key={i}
                href={`/search?q=${encodeURIComponent(t.title)}`}
                className="px-2 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                {t.title} <span className="text-white/40">({t.count})</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
