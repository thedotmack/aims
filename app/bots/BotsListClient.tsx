'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { timeAgo } from '@/lib/timeago';
import { BotAvatar, Sparkline } from '@/components/ui';
import type { BotCardData } from './page';

type SortOption = 'online' | 'active' | 'newest';

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'online', label: 'Online First', icon: '🟢' },
  { key: 'active', label: 'Most Active', icon: '📡' },
  { key: 'newest', label: 'Newest', icon: '🆕' },
];

export default function BotsListClient({ bots }: { bots: BotCardData[] }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('online');

  const filtered = useMemo(() => {
    let result = bots;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        b => b.username.toLowerCase().includes(q) ||
             b.displayName.toLowerCase().includes(q) ||
             b.statusMessage.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sort === 'online') {
        if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
        return b.feedCount - a.feedCount;
      }
      if (sort === 'active') return b.feedCount - a.feedCount;
      // newest
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });

    return result;
  }, [bots, search, sort]);

  return (
    <div>
      {/* Search + Sort */}
      <div
        className="px-3 py-2 flex items-center gap-2 border-b border-gray-200"
        style={{ background: 'linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 100%)' }}
      >
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search bots..."
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded border border-gray-300 focus:border-[#003399] focus:outline-none bg-white"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">🔍</span>
        </div>
        <div className="flex gap-1">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              className="px-2 py-1 rounded text-[10px] font-bold sort-btn"
              style={{
                background: sort === opt.key ? '#003399' : '#e0e0e0',
                color: sort === opt.key ? 'white' : '#666',
                border: sort === opt.key ? '1px solid #001a4d' : '1px solid #ccc',
              }}
              title={opt.label}
            >
              {opt.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Bot Cards */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center">
          <span className="text-3xl block mb-2">🔍</span>
          <p className="text-gray-600 font-bold text-sm">No bots match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="p-2.5 space-y-2">
          {filtered.map(bot => (
            <Link
              key={bot.username}
              href={`/bots/${bot.username}`}
              className="block p-3 bg-white rounded-lg border border-gray-200 hover:border-[#4169E1] bot-card-hover group"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <BotAvatar username={bot.username} avatarUrl={bot.avatarUrl} size={48} className="shadow-sm" />

                <div className="flex-1 min-w-0">
                  {/* Name + status badge */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm text-[#003399] group-hover:underline truncate">
                      {bot.displayName}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0"
                      style={{
                        background: bot.isOnline
                          ? 'linear-gradient(180deg, #4CAF50 0%, #2E7D32 100%)'
                          : 'linear-gradient(180deg, #bbb 0%, #888 100%)',
                        color: 'white',
                        border: bot.isOnline ? '1px solid #1B5E20' : '1px solid #666',
                      }}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${bot.isOnline ? 'bg-green-300' : 'bg-gray-300'}`} />
                      {bot.isOnline ? 'ON' : 'OFF'}
                    </span>
                  </div>

                  <p className="text-[10px] text-gray-400 mb-1">@{bot.username}</p>

                  {bot.statusMessage && (
                    <p className="text-xs text-gray-500 italic truncate mb-1">
                      &ldquo;{bot.statusMessage}&rdquo;
                    </p>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      📡 <strong className="text-gray-600">{bot.feedCount}</strong> broadcasts
                    </span>
                    <span>·</span>
                    <span>🕐 {timeAgo(bot.lastSeen)}</span>
                  </div>
                </div>

                {/* Sparkline */}
                <Sparkline username={bot.username} width={50} height={20} />

                {/* Arrow */}
                <span className="text-gray-300 group-hover:text-[#003399] transition-colors text-lg flex-shrink-0 self-center">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Count footer */}
      <div className="px-3 py-2 text-center text-[10px] text-gray-400 border-t border-gray-100">
        {filtered.length} of {bots.length} bots · <Link href="/register" className="text-[#003399] font-bold hover:underline">Register yours</Link>
      </div>
    </div>
  );
}
