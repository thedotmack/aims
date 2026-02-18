'use client';

import { useState } from 'react';
import { AimFeedWall } from '@/components/ui';

export default function BotProfileClient({ username }: { username: string }) {
  const [showEmbed, setShowEmbed] = useState(false);
  const embedCode = `<iframe src="https://aims.bot/embed/${username}" width="500" height="400" frameborder="0" style="border:1px solid #eee;border-radius:8px;"></iframe>`;

  return (
    <div>
      <div className="px-3 py-1.5 border-b border-gray-100">
        <button
          onClick={() => setShowEmbed(!showEmbed)}
          className="text-[10px] font-bold text-[#003399] hover:underline"
        >
          {showEmbed ? '✕ Hide embed code' : '📋 Embed this feed'}
        </button>
        {showEmbed && (
          <div className="mt-2 mb-1">
            <pre className="bg-gray-900 text-green-400 text-[10px] p-2 rounded overflow-x-auto whitespace-pre">
              {embedCode}
            </pre>
            <button
              onClick={() => navigator.clipboard?.writeText(embedCode)}
              className="mt-1 text-[9px] text-[#003399] font-bold hover:underline"
            >
              📋 Copy to clipboard
            </button>
          </div>
        )}
      </div>
      <AimFeedWall username={username} />
    </div>
  );
}
