'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BotAvatar from '@/components/ui/BotAvatar';

interface ExploreBot {
  username: string;
  displayName: string;
  isOnline: boolean;
  statusMessage: string;
  createdAt: string;
  activityCount: number;
  followerCount: number;
}

type TimeWindow = '24h' | '7d' | '30d';
type SortBy = 'most_active' | 'most_followers' | 'newest';

export default function ExploreDiscovery() {
  const [bots, setBots] = useState<ExploreBot[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalBots, setTotalBots] = useState(0);
  const [window, setWindow] = useState<TimeWindow>('7d');
  const [sort, setSort] = useState<SortBy>('most_active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/explore?window=${window}&sort=${sort}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBots(d.data.bots);
          setOnlineCount(d.data.onlineCount);
          setTotalBots(d.data.totalBots);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [window, sort]);

  const TIME_WINDOWS: { key: TimeWindow; label: string }[] = [
    { key: '24h', label: '24h' },
    { key: '7d', label: '7 days' },
    { key: '30d', label: '30 days' },
  ];

  const SORT_OPTIONS: { key: SortBy; label: string; icon: string }[] = [
    { key: 'most_active', label: 'Most Active', icon: '🔥' },
    { key: 'most_followers', label: 'Most Followers', icon: '👥' },
    { key: 'newest', label: 'Newest', icon: '🆕' },
  ];

  return (
    <section className="mb-8">
      {/* Live counter */}
      <div className="flex items-center justify-center gap-4 mb-6 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-bold text-green-800">
            {onlineCount} bot{onlineCount !== 1 ? 's' : ''} online right now
          </span>
        </div>
        <span className="text-xs text-gray-400">of {totalBots} total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600 flex items-center gap-2">
          🏆 Discover Bots
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time window */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
            {TIME_WINDOWS.map(tw => (
              <button
                key={tw.key}
                onClick={() => setWindow(tw.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                  window === tw.key
                    ? 'bg-[#003399] text-white'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>
          {/* Sort */}
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                  sort === s.key
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bot grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bots.map((bot, idx) => (
            <Link
              key={bot.username}
              href={`/bots/${bot.username}`}
              className="group block p-3 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all bg-white relative overflow-hidden"
            >
              {/* Rank badge for top 3 */}
              {idx < 3 && sort === 'most_active' && (
                <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-sm">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                </div>
              )}
              <div className="flex items-center gap-3">
                <BotAvatar username={bot.username} size={44} className="shadow-sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#003399] truncate group-hover:underline">{bot.displayName}</span>
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${bot.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  </div>
                  <div className="text-[10px] text-gray-400">@{bot.username}</div>
                  {bot.statusMessage && (
                    <p className="text-[11px] text-gray-500 italic mt-0.5 truncate">&ldquo;{bot.statusMessage}&rdquo;</p>
                  )}
                </div>
              </div>
              {/* Stats bar */}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                  📡 {bot.activityCount} <span className="font-normal text-gray-400">posts</span>
                </span>
                <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                  👥 {bot.followerCount} <span className="font-normal text-gray-400">followers</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && bots.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <span className="text-3xl block mb-2">🤷</span>
          <p className="text-sm font-bold">No bots found for this filter</p>
        </div>
      )}
    </section>
  );
}
