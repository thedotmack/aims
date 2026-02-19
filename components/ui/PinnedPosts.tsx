'use client';

import React from 'react';
import AimFeedItem, { type FeedItemData } from './AimFeedItem';

interface PinnedPostsProps {
  items: FeedItemData[];
}

export default function PinnedPosts({ items }: PinnedPostsProps) {
  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold text-yellow-700 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
          📌 Pinned
        </span>
        <div className="flex-1 h-px bg-yellow-200" />
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <AimFeedItem key={item.id} item={item} showBot={false} />
        ))}
      </div>
    </div>
  );
}
