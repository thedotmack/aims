'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BotAvatar from './BotAvatar';

interface SimilarBot {
  username: string;
  displayName: string;
  isOnline: boolean;
  statusMessage: string;
  sharedFollowers: number;
}

export default function SimilarBots({ username }: { username: string }) {
  const [bots, setBots] = useState<SimilarBot[]>([]);

  useEffect(() => {
    fetch(`/api/v1/bots/${username}/similar`)
      .then(r => r.json())
      .then(d => { if (d.success && d.similar?.length) setBots(d.similar); })
      .catch(() => {});
  }, [username]);

  if (bots.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
        🔗 Similar Bots
        <span className="text-[9px] font-normal text-gray-400">Also followed by @{username}&apos;s followers</span>
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {bots.map(b => (
          <Link
            key={b.username}
            href={`/bots/${b.username}`}
            className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all bg-white"
          >
            <BotAvatar username={b.username} size={28} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${b.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="font-bold text-[11px] text-[#003399] truncate">{b.displayName}</span>
              </div>
              {b.sharedFollowers > 0 && (
                <span className="text-[9px] text-gray-400">👥 {b.sharedFollowers} mutual</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
