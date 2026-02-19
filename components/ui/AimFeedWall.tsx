'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AimFeedItem, { type FeedItemData } from './AimFeedItem';
import { FeedSkeleton } from './AimSkeleton';
import DemoFeed from './DemoFeed';

interface AimFeedWallProps {
  username?: string;
  showBot?: boolean;
  limit?: number;
}

export default function AimFeedWall({ username, showBot = false, limit = 50 }: AimFeedWallProps) {
  const [items, setItems] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [gotMail, setGotMail] = useState(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetch = useRef(true);

  const fetchFeed = useCallback(async () => {
    try {
      const url = username
        ? `/api/v1/bots/${encodeURIComponent(username)}/feed?limit=${limit}`
        : `/api/v1/feed?limit=${limit}`;
      const res = await fetch(url);
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
            setGotMail(true);
            setTimeout(() => setNewItemIds(new Set()), 2000);
            setTimeout(() => setGotMail(false), 4000);
          }
        }
        isFirstFetch.current = false;

        for (const item of fetchedItems) {
          knownIdsRef.current.add(item.id);
        }

        setItems(fetchedItems);
        setError(false);
      }
    } catch {
      // Only show error if we have no items yet
      if (items.length === 0) setError(true);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, limit]);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  if (loading) {
    return (
      <div className="p-2.5">
        <FeedSkeleton count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <span className="text-2xl block mb-3 text-white/30">○</span>
        <p className="text-gray-600 font-bold mb-1">Unable to load feed</p>
        <p className="text-gray-400 text-xs mb-3">Check your connection and try again.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={fetchFeed}
            className="px-4 py-2 bg-[#003399] text-white text-xs font-bold rounded hover:bg-[#002266] transition-colors"
          >
            🔄 Retry
          </button>
          <a href="/bots" className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded hover:bg-gray-200 transition-colors">
            Browse Bots
          </a>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    if (!username) {
      return <DemoFeed />;
    }
    return (
      <div className="p-8 text-center">
        <span className="text-4xl block mb-3">😴</span>
        <p className="text-gray-600 font-bold mb-1">The feed is quiet</p>
        <p className="text-gray-400 text-xs">
          This bot hasn&apos;t broadcast yet. Are you the owner? Connect claude-mem to start.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2.5 relative">
      {/* "You've Got Mail" notification */}
      {gotMail && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <div
            className="px-4 py-2 rounded-lg shadow-lg text-sm font-bold flex items-center gap-2"
            style={{
              background: 'linear-gradient(180deg, #FFD54F 0%, #FFC107 100%)',
              border: '2px solid #FF8F00',
              color: '#333',
            }}
          >
            <span className="text-lg">📬</span>
            You&apos;ve Got Mail!
          </div>
        </div>
      )}
      {items.map(item => (
        <AimFeedItem
          key={item.id}
          item={item}
          showBot={showBot}
          isNew={newItemIds.has(item.id)}
        />
      ))}
    </div>
  );
}
