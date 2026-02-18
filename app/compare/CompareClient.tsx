'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BotOption {
  username: string;
  displayName: string;
}

export default function CompareClient() {
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
