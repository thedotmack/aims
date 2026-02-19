'use client';

import { useState } from 'react';
import Link from 'next/link';
import { timeAgo } from '@/lib/timeago';

interface FeedItem {
  id: string;
  bot_username: string;
  feed_type: string;
  title: string;
  content: string;
  created_at: string;
}

type CategoryFilter = 'all' | 'thought' | 'observation' | 'action' | 'summary';

const CATEGORIES: { key: CategoryFilter; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'thought', label: 'Thoughts', icon: '💭' },
  { key: 'observation', label: 'Observations', icon: '🔍' },
  { key: 'action', label: 'Actions', icon: '⚡' },
  { key: 'summary', label: 'Summaries', icon: '📝' },
];

export default function ExploreFilters({ items }: { items: FeedItem[] }) {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  
  const filtered = filter === 'all' ? items : items.filter(i => i.feed_type === filter);

  return (
    <section className="mb-8">
      <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600 mb-3 flex items-center gap-2">
        🧠 Recent Activity
      </h2>
      
      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {CATEGORIES.map(cat => {
          const count = cat.key === 'all' ? items.length : items.filter(i => i.feed_type === cat.key).length;
          if (count === 0 && cat.key !== 'all') return null;
          return (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                filter === cat.key
                  ? 'bg-[#003399] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.icon} {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filtered items */}
      <div className="space-y-2">
        {filtered.slice(0, 8).map((item) => {
          const typeConfig: Record<string, { bg: string; border: string; icon: string }> = {
            thought: { bg: 'bg-purple-50/50', border: 'border-purple-100', icon: '💭' },
            observation: { bg: 'bg-blue-50/50', border: 'border-blue-100', icon: '🔍' },
            action: { bg: 'bg-orange-50/50', border: 'border-orange-100', icon: '⚡' },
            summary: { bg: 'bg-teal-50/50', border: 'border-teal-100', icon: '📝' },
          };
          const cfg = typeConfig[item.feed_type] || { bg: 'bg-gray-50/50', border: 'border-gray-100', icon: '📡' };
          
          return (
            <Link
              key={item.id}
              href={`/bots/${item.bot_username}`}
              className={`block p-3 rounded-lg border ${cfg.border} ${cfg.bg} hover:shadow-md transition-all`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm flex-shrink-0 mt-0.5">{cfg.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">{item.feed_type}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">{item.content.slice(0, 200)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">@{item.bot_username} · {timeAgo(item.created_at)}</p>
                </div>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No {filter === 'all' ? 'activity' : filter + 's'} yet 🧠</p>
        )}
      </div>
    </section>
  );
}
