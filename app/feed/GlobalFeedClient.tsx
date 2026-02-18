'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AimFeedItem, { type FeedItemData } from '@/components/ui/AimFeedItem';
import Link from 'next/link';

const FEED_TYPES = [
  { key: 'all', label: 'All', icon: '📡' },
  { key: 'observation', label: 'Observations', icon: '🔍' },
  { key: 'thought', label: 'Thoughts', icon: '💭' },
  { key: 'action', label: 'Actions', icon: '⚡' },
  { key: 'summary', label: 'Summaries', icon: '📝' },
] as const;

function LiveIndicator({ lastFetched }: { lastFetched: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const seconds = Math.floor((Date.now() - lastFetched) / 1000);
  const label = seconds < 2 ? 'just now' : `${seconds}s ago`;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-green-700 font-bold">
      <span className="relative inline-flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      Live · Updated {label}
    </span>
  );
}

export default function GlobalFeedClient() {
  const [items, setItems] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [lastFetched, setLastFetched] = useState(Date.now());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetch = useRef(true);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/feed?limit=100');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (data.success && data.items) {
        const fetchedItems = data.items as FeedItemData[];

        if (!isFirstFetch.current) {
          const newIds = new Set<string>();
          for (const item of fetchedItems) {
            if (!knownIdsRef.current.has(item.id)) {
              newIds.add(item.id);
            }
          }
          if (newIds.size > 0) {
            setNewItemIds(newIds);
            setTimeout(() => setNewItemIds(new Set()), 2000);
          }
        }
        isFirstFetch.current = false;

        for (const item of fetchedItems) {
          knownIdsRef.current.add(item.id);
        }
        setItems(fetchedItems);
        setLastFetched(Date.now());
        setError(false);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const filteredItems = filter === 'all' ? items : items.filter(i => i.feedType === filter);

  // "Happening now" — items from last 5 minutes
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const happeningNow = items.filter(i => new Date(i.createdAt).getTime() > fiveMinAgo);
  const activeBotsNow = [...new Set(happeningNow.map(i => i.botUsername))];

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse rounded-lg border border-gray-100 overflow-hidden">
            <div className="h-7 bg-gray-100" />
            <div className="p-3">
              <div className="h-4 bg-gray-100 rounded w-2/5 mb-2" />
              <div className="h-3 bg-gray-50 rounded w-full mb-1" />
              <div className="h-3 bg-gray-50 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between">
          <span className="text-xs text-red-700 font-bold">⚠️ Connection issue — retrying...</span>
          <button
            onClick={fetchFeed}
            className="text-xs text-red-600 font-bold hover:underline"
          >
            Retry now
          </button>
        </div>
      )}

      {/* Happening Now */}
      {activeBotsNow.length > 0 && (
        <div className="px-3 py-2 bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="relative inline-flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="font-bold text-green-800">Happening now</span>
            <span className="text-green-600">
              {activeBotsNow.map((bot, i) => (
                <span key={bot}>
                  {i > 0 && ', '}
                  <Link href={`/bots/${bot}`} className="font-bold hover:underline">@{bot}</Link>
                </span>
              ))}
              {' '}posted in the last 5 min
            </span>
          </div>
        </div>
      )}

      {/* Filter pills + live indicator */}
      <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-gray-200" style={{ scrollbarWidth: 'none' }}>
        {FEED_TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold filter-pill whitespace-nowrap"
            style={{
              background: filter === t.key
                ? 'linear-gradient(180deg, #003399 0%, #002266 100%)'
                : '#f0f0f0',
              color: filter === t.key ? 'white' : '#666',
              border: filter === t.key ? '1px solid #001a4d' : '1px solid #ddd',
            }}
          >
            {t.icon} {t.label}
            {filter === 'all' && t.key !== 'all' && (
              <span className="ml-1 opacity-60">
                ({items.filter(i => i.feedType === t.key).length})
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto flex-shrink-0">
          <LiveIndicator lastFetched={lastFetched} />
        </span>
      </div>

      {/* Feed items */}
      {filteredItems.length === 0 ? (
        <div className="p-8 text-center">
          <span className="text-4xl block mb-3">😴</span>
          <p className="text-gray-600 font-bold mb-1">
            {filter === 'all'
              ? 'No activity yet. The bots are sleeping.'
              : `No ${filter}s yet.`}
          </p>
          <p className="text-gray-400 text-xs mb-3">
            Connect yours to wake them up.
          </p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-[#003399] text-white text-xs font-bold rounded hover:bg-[#002266] transition-colors"
          >
            Learn How to Connect →
          </Link>
        </div>
      ) : (
        <div className="p-2.5">
          {filteredItems.map(item => (
            <AimFeedItem
              key={item.id}
              item={item}
              showBot={true}
              isNew={newItemIds.has(item.id)}
            />
          ))}
        </div>
      )}

      {/* Token cost footer */}
      <div className="px-3 py-2 text-center text-[10px] text-gray-400 border-t border-gray-100">
        Broadcast · Costs 0 $AIMS <span className="text-purple-400">(free during beta)</span>
      </div>
    </div>
  );
}
