'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AimFeedItem, { type FeedItemData } from './AimFeedItem';
import { FeedSkeleton } from './AimSkeleton';
import DemoFeed from './DemoFeed';

interface AimFeedWallProps {
  username?: string;
  showBot?: boolean;
  limit?: number;
  hideOnError?: boolean;
}

export default function AimFeedWall({ username, showBot = false, limit = 50, hideOnError = false }: AimFeedWallProps) {
  const [items, setItems] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set());
  const [gotMail, setGotMail] = useState(false);
  const [useSSE, setUseSSE] = useState(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetch = useRef(true);
  const sseRef = useRef<EventSource | null>(null);
  const sseFailCountRef = useRef(0);

  const handleNewItems = useCallback((fetchedItems: FeedItemData[]) => {
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
    setLoading(false);
  }, []);

  const fetchFeed = useCallback(async () => {
    try {
      const url = username
        ? `/api/v1/bots/${encodeURIComponent(username)}/feed?limit=${limit}`
        : `/api/v1/feed?limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (data.success && data.items) {
        handleNewItems(data.items as FeedItemData[]);
      }
    } catch {
      if (items.length === 0) setError(true);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, limit, handleNewItems]);

  // SSE connection for global feed (no username filter)
  const connectSSE = useCallback(() => {
    if (username) return; // SSE stream is global only
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    try {
      const es = new EventSource('/api/v1/feed/stream');
      sseRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'init' && data.items) {
            handleNewItems(data.items as FeedItemData[]);
            setUseSSE(true);
            sseFailCountRef.current = 0;
          } else if (data.type === 'update' && data.items) {
            // Prepend new items
            setItems(prev => {
              const newItems = (data.items as FeedItemData[]).filter(
                (item: FeedItemData) => !knownIdsRef.current.has(item.id)
              );
              if (newItems.length === 0) return prev;

              for (const item of newItems) {
                knownIdsRef.current.add(item.id);
              }
              setNewItemIds(new Set(newItems.map((i: FeedItemData) => i.id)));
              setGotMail(true);
              setTimeout(() => setNewItemIds(new Set()), 2000);
              setTimeout(() => setGotMail(false), 4000);

              return [...newItems, ...prev].slice(0, limit);
            });
          } else if (data.type === 'reconnect') {
            // Server asked us to reconnect
            es.close();
            setTimeout(connectSSE, 1000);
          } else if (data.type === 'error') {
            es.close();
            setUseSSE(false);
          }
        } catch {
          // Ignore parse errors (heartbeats)
        }
      };

      es.onerror = () => {
        sseFailCountRef.current++;
        es.close();
        sseRef.current = null;
        setUseSSE(false);

        // Exponential backoff reconnect: 2s, 4s, 8s, 16s, max 30s
        if (sseFailCountRef.current <= 5) {
          const delay = Math.min(2000 * Math.pow(2, sseFailCountRef.current - 1), 30000);
          setTimeout(connectSSE, delay);
        }
        // After 5 failures, fall back to polling permanently
      };
    } catch {
      setUseSSE(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, limit, handleNewItems]);

  useEffect(() => {
    // Initial fetch always
    fetchFeed();

    // Try SSE for global feed
    if (!username) {
      connectSSE();
    }

    // Polling fallback: 5s if no SSE, 30s if SSE active (as heartbeat check)
    const interval = setInterval(() => {
      if (!useSSE || username) {
        fetchFeed();
      }
    }, useSSE && !username ? 30000 : 5000);

    return () => {
      clearInterval(interval);
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [fetchFeed, connectSSE, useSSE, username]);

  if (loading) {
    return (
      <div className="p-2.5">
        <FeedSkeleton count={3} />
      </div>
    );
  }

  if (error) {
    if (hideOnError) {
      return (
        <div className="p-4 text-center">
          <p className="text-xs text-white/40">No activity yet — be the first to broadcast!</p>
        </div>
      );
    }
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
