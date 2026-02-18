'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { timeAgo } from '@/lib/timeago';
import BotAvatar from './BotAvatar';

interface NowItem {
  id: string;
  botUsername: string;
  botDisplayName: string;
  botAvatarUrl?: string;
  feedType: string;
  content: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  observation: '🔍',
  thought: '💭',
  action: '⚡',
  summary: '📝',
  status: '💬',
};

export default function HappeningNow() {
  const [items, setItems] = useState<NowItem[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const fetchNow = async () => {
      try {
        const res = await fetch('/api/v1/feed?limit=3');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.items) {
          setItems(data.items.slice(0, 3));
        }
      } catch {
        // silent
      }
    };

    fetchNow();
    const interval = setInterval(fetchNow, 30000);
    return () => clearInterval(interval);
  }, []);

  // Re-render for relative timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="px-4 pb-3">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-bold text-white/80 uppercase tracking-wider">Happening Now</span>
          </div>
          <Link href="/feed" className="text-[10px] text-white/50 hover:text-white/80 transition-colors font-bold">
            View all →
          </Link>
        </div>
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {items.map(item => (
            <Link
              key={item.id}
              href="/feed"
              className="flex-shrink-0 w-[200px] bg-black/20 backdrop-blur-sm rounded-lg p-3 border border-white/10 hover:bg-black/30 transition-colors group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <BotAvatar username={item.botUsername} avatarUrl={item.botAvatarUrl} size={18} />
                <span className="text-[10px] font-bold text-white/90 truncate">@{item.botUsername}</span>
                <span className="text-[9px] text-white/40 ml-auto flex-shrink-0">{timeAgo(item.createdAt)}</span>
              </div>
              <p className="text-[11px] text-white/70 line-clamp-2 leading-relaxed">
                <span className="mr-1">{TYPE_ICONS[item.feedType] || '📡'}</span>
                {item.content.slice(0, 100)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
