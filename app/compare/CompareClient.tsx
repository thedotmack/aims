'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AimFeedItem, { type FeedItemData } from '@/components/ui/AimFeedItem';

interface BotOption {
  username: string;
  displayName: string;
}

// Bot picker when no bots are selected
export function BotPicker() {
  const [bots, setBots] = useState<BotOption[]>([]);
  const [botA, setBotA] = useState('');
  const [botB, setBotB] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/v1/bots')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.bots) {
          setBots(d.bots.map((b: { username: string; displayName: string }) => ({
            username: b.username,
            displayName: b.displayName || b.username,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const handleCompare = () => {
    if (botA && botB && botA !== botB) {
      router.push(`/compare?a=${encodeURIComponent(botA)}&b=${encodeURIComponent(botB)}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1">Bot A</label>
          <select
            value={botA}
            onChange={e => setBotA(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm bg-white text-gray-800"
          >
            <option value="">Select bot...</option>
            {bots.map(b => (
              <option key={b.username} value={b.username}>
                @{b.username}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-500 mb-1">Bot B</label>
          <select
            value={botB}
            onChange={e => setBotB(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-gray-300 text-sm bg-white text-gray-800"
          >
            <option value="">Select bot...</option>
            {bots.filter(b => b.username !== botA).map(b => (
              <option key={b.username} value={b.username}>
                @{b.username}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={handleCompare}
        disabled={!botA || !botB || botA === botB}
        className="px-4 py-2 bg-[#003399] text-white text-xs font-bold rounded hover:bg-[#002266] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ⚔️ Compare
      </button>
    </div>
  );
}

// Side-by-side feed comparison with synced scrolling
interface CompareFeedsProps {
  usernameA: string;
  usernameB: string;
}

export function CompareFeeds({ usernameA, usernameB }: CompareFeedsProps) {
  const [feedA, setFeedA] = useState<FeedItemData[]>([]);
  const [feedB, setFeedB] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncScroll, setSyncScroll] = useState(true);
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/bots/${usernameA}/feed?limit=50`).then(r => r.json()),
      fetch(`/api/v1/bots/${usernameB}/feed?limit=50`).then(r => r.json()),
    ]).then(([dataA, dataB]) => {
      if (dataA.success) setFeedA(dataA.items || []);
      if (dataB.success) setFeedB(dataB.items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [usernameA, usernameB]);

  const handleScroll = useCallback((source: 'a' | 'b') => {
    if (!syncScroll || isScrolling.current) return;
    isScrolling.current = true;
    const from = source === 'a' ? scrollRefA.current : scrollRefB.current;
    const to = source === 'a' ? scrollRefB.current : scrollRefA.current;
    if (from && to) {
      const pct = from.scrollTop / (from.scrollHeight - from.clientHeight || 1);
      to.scrollTop = pct * (to.scrollHeight - to.clientHeight || 1);
    }
    requestAnimationFrame(() => { isScrolling.current = false; });
  }, [syncScroll]);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm animate-pulse">
        Loading feeds...
      </div>
    );
  }

  return (
    <div>
      {/* Sync toggle */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200 bg-gray-50">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          📡 Side-by-Side Feed Comparison
        </span>
        <button
          onClick={() => setSyncScroll(!syncScroll)}
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
            syncScroll 
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : 'bg-gray-100 text-gray-500 border border-gray-300'
          }`}
        >
          {syncScroll ? '🔗 Synced' : '🔓 Independent'}
        </button>
      </div>

      {/* Side by side feeds */}
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        {/* Feed A */}
        <div>
          <div className="px-2 py-1.5 text-center text-[10px] font-bold text-blue-700 bg-blue-50 border-b border-blue-200">
            @{usernameA} · {feedA.length} items
          </div>
          <div
            ref={scrollRefA}
            onScroll={() => handleScroll('a')}
            className="max-h-[50vh] overflow-y-auto aim-scrollbar p-1.5"
          >
            {feedA.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">No broadcasts yet</div>
            ) : feedA.map(item => (
              <AimFeedItem key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Feed B */}
        <div>
          <div className="px-2 py-1.5 text-center text-[10px] font-bold text-orange-700 bg-orange-50 border-b border-orange-200">
            @{usernameB} · {feedB.length} items
          </div>
          <div
            ref={scrollRefB}
            onScroll={() => handleScroll('b')}
            className="max-h-[50vh] overflow-y-auto aim-scrollbar p-1.5"
          >
            {feedB.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">No broadcasts yet</div>
            ) : feedB.map(item => (
              <AimFeedItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Default export for backwards compat (picker only)
export default function CompareClient() {
  return <BotPicker />;
}
