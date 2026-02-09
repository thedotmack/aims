'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface BuddyBot {
  username: string;
  displayName: string;
  isOnline: boolean;
  statusMessage: string;
}

export interface AimBuddyListProps {
  bots: BuddyBot[];
  onBotClick?: (username: string) => void;
}

export default function AimBuddyList({ bots, onBotClick }: AimBuddyListProps) {
  const router = useRouter();
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [offlineOpen, setOfflineOpen] = useState(true);

  const handleClick = (username: string) => {
    if (onBotClick) {
      onBotClick(username);
    } else {
      router.push(`/bots/${username}`);
    }
  };

  const online = bots.filter(b => b.isOnline);
  const offline = bots.filter(b => !b.isOnline);

  const BotEntry = ({ bot }: { bot: BuddyBot }) => (
    <div
      onClick={() => handleClick(bot.username)}
      className="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-[#dce8ff] transition-colors"
    >
      <span
        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{
          background: bot.isOnline
            ? 'linear-gradient(180deg, #4CAF50 0%, #2E7D32 100%)'
            : 'linear-gradient(180deg, #bbb 0%, #888 100%)',
          border: bot.isOnline ? '1px solid #1B5E20' : '1px solid #666',
        }}
      />
      <span className="font-bold text-sm text-[#003399] truncate">
        {bot.displayName || bot.username}
      </span>
      {bot.statusMessage && (
        <span className="text-xs text-gray-500 italic truncate flex-1 min-w-0">
          — {bot.statusMessage}
        </span>
      )}
    </div>
  );

  const GroupHeader = ({
    label,
    count,
    open,
    toggle,
  }: {
    label: string;
    count: number;
    open: boolean;
    toggle: () => void;
  }) => (
    <div
      onClick={toggle}
      className="flex items-center gap-1 px-2 py-1 cursor-pointer select-none font-bold text-xs text-[#333] uppercase tracking-wide"
      style={{
        background: 'linear-gradient(180deg, #e8e8e8 0%, #c0c0c0 100%)',
        borderTop: '1px solid #fff',
        borderBottom: '1px solid #808080',
      }}
    >
      <span className="text-[10px]">{open ? '▼' : '►'}</span>
      <span>{label} ({count})</span>
    </div>
  );

  return (
    <div className="text-sm">
      <GroupHeader label="Online" count={online.length} open={onlineOpen} toggle={() => setOnlineOpen(!onlineOpen)} />
      {onlineOpen && (
        <div className="py-1">
          {online.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-2 italic">No bots online</p>
          ) : (
            online.map(bot => <BotEntry key={bot.username} bot={bot} />)
          )}
        </div>
      )}

      <GroupHeader label="Offline" count={offline.length} open={offlineOpen} toggle={() => setOfflineOpen(!offlineOpen)} />
      {offlineOpen && (
        <div className="py-1">
          {offline.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-2 italic">No offline bots</p>
          ) : (
            offline.map(bot => <BotEntry key={bot.username} bot={bot} />)
          )}
        </div>
      )}
    </div>
  );
}
