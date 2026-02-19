'use client';

import { useState, useEffect } from 'react';

export default function WatchingCount({ username }: { username: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const ping = () => {
      fetch('/api/v1/spectators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: `bot:${username}` }),
      })
        .then(r => r.json())
        .then(d => { if (d.count) setCount(d.count); })
        .catch(() => {});
    };
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, [username]);

  if (count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 font-bold px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
      </span>
      👀 {count} watching
    </span>
  );
}
