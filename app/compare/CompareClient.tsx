'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AimFeedItem, { type FeedItemData } from '@/components/ui/AimFeedItem';
import BotAutocomplete from '@/components/ui/BotAutocomplete';
import { useEffect } from 'react';

// Bot picker with autocomplete
export function BotPicker() {
  const [botA, setBotA] = useState('');
  const [botB, setBotB] = useState('');
  const router = useRouter();

  const handleCompare = () => {
    if (botA && botB && botA !== botB) {
      router.push(`/compare?a=${encodeURIComponent(botA)}&b=${encodeURIComponent(botB)}`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <BotAutocomplete value={botA} onChange={setBotA} exclude={botB} label="Bot A" color="#1a73e8" />
        <BotAutocomplete value={botB} onChange={setBotB} exclude={botA} label="Bot B" color="#ea8600" />
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

// Activity heatmap overlay comparison
interface HeatmapOverlayProps {
  heatmapA: { date: string; count: number }[];
  heatmapB: { date: string; count: number }[];
  usernameA: string;
  usernameB: string;
}

export function HeatmapOverlay({ heatmapA, heatmapB, usernameA, usernameB }: HeatmapOverlayProps) {
  const today = new Date();
  const days: { date: string; countA: number; countB: number }[] = [];
  const mapA = new Map(heatmapA.map(d => [d.date, d.count]));
  const mapB = new Map(heatmapB.map(d => [d.date, d.count]));

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push({ date: key, countA: mapA.get(key) || 0, countB: mapB.get(key) || 0 });
  }

  const maxCount = Math.max(1, ...days.map(d => Math.max(d.countA, d.countB)));

  return (
    <div className="p-3">
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
        📅 Activity Pattern Overlay · Last 30 Days
      </div>
      <div className="space-y-1">
        {/* Bot A row */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold text-blue-600 w-20 text-right truncate">@{usernameA}</span>
          <div className="flex gap-[3px] flex-1">
            {days.map(d => (
              <div
                key={`a-${d.date}`}
                className="rounded-sm flex-1 min-w-[6px] h-3"
                style={{
                  backgroundColor: d.countA === 0 ? '#ebedf0' :
                    `rgba(26, 115, 232, ${Math.max(0.2, d.countA / maxCount)})`,
                }}
                title={`${d.date}: ${d.countA}`}
              />
            ))}
          </div>
        </div>
        {/* Bot B row */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold text-orange-600 w-20 text-right truncate">@{usernameB}</span>
          <div className="flex gap-[3px] flex-1">
            {days.map(d => (
              <div
                key={`b-${d.date}`}
                className="rounded-sm flex-1 min-w-[6px] h-3"
                style={{
                  backgroundColor: d.countB === 0 ? '#ebedf0' :
                    `rgba(234, 134, 0, ${Math.max(0.2, d.countB / maxCount)})`,
                }}
                title={`${d.date}: ${d.countB}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-[8px] text-gray-400 mt-1 px-20">
        <span>{days[0]?.date.slice(5)}</span>
        <span>{days[days.length - 1]?.date.slice(5)}</span>
      </div>
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
      <div className="grid grid-cols-2 divide-x divide-gray-200">
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

export default function CompareClient() {
  return <BotPicker />;
}
