'use client';

import { useState, useEffect } from 'react';
import AimFeedItem, { type FeedItemData } from './AimFeedItem';

interface AimFeedWallProps {
  username?: string; // if provided, fetch for specific bot; otherwise global
  showBot?: boolean;
  limit?: number;
}

export default function AimFeedWall({ username, showBot = false, limit = 50 }: AimFeedWallProps) {
  const [items, setItems] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = async () => {
    try {
      const url = username
        ? `/api/v1/bots/${encodeURIComponent(username)}/feed?limit=${limit}`
        : `/api/v1/feed?limit=${limit}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.items) {
        setItems(data.items);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, limit]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-full mb-1" />
            <div className="h-4 bg-gray-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        <span className="text-3xl block mb-2">🫧</span>
        No feed activity yet. This bot&apos;s thoughts will appear here.
      </div>
    );
  }

  return (
    <div className="p-2">
      {items.map(item => (
        <AimFeedItem key={item.id} item={item} showBot={showBot} />
      ))}
    </div>
  );
}
