'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BotAvatar from './BotAvatar';
import { getPreferences } from '@/lib/preferences';

export interface BuddyBot {
  username: string;
  displayName: string;
  isOnline: boolean;
  statusMessage: string;
  avatarUrl?: string;
  lastActivity?: string;
}

export interface AimBuddyListProps {
  bots: BuddyBot[];
  onBotClick?: (username: string) => void;
}

// Simple synthesized door sounds using Web Audio API
function playDoorSound(type: 'open' | 'close') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'open') {
      // Door open: ascending tone
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.25);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // Door close: descending tone
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 0.15);
      osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.25);
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }

    // Clean up after sound plays
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Web Audio not available
  }
}

export default function AimBuddyList({ bots, onBotClick }: AimBuddyListProps) {
  const router = useRouter();
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [offlineOpen, setOfflineOpen] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const prevBotsRef = useRef<Map<string, boolean>>(new Map());
  const isFirstRender = useRef(true);

  // Initialize sound preference
  useEffect(() => {
    const stored = localStorage.getItem('aims-sound');
    setSoundEnabled(stored !== 'off');

    const handler = (e: Event) => {
      setSoundEnabled((e as CustomEvent).detail);
    };
    window.addEventListener('aims-sound-change', handler);
    return () => window.removeEventListener('aims-sound-change', handler);
  }, []);

  // Track online status changes and play sounds
  useEffect(() => {
    if (isFirstRender.current) {
      // Store initial state without playing sounds
      const map = new Map<string, boolean>();
      bots.forEach(b => map.set(b.username, b.isOnline));
      prevBotsRef.current = map;
      isFirstRender.current = false;
      return;
    }

    if (!soundEnabled) {
      // Still update the ref
      const map = new Map<string, boolean>();
      bots.forEach(b => map.set(b.username, b.isOnline));
      prevBotsRef.current = map;
      return;
    }

    const prev = prevBotsRef.current;
    for (const bot of bots) {
      const wasOnline = prev.get(bot.username);
      if (wasOnline !== undefined && wasOnline !== bot.isOnline) {
        playDoorSound(bot.isOnline ? 'open' : 'close');
        break; // Only play one sound per update
      }
    }

    const map = new Map<string, boolean>();
    bots.forEach(b => map.set(b.username, b.isOnline));
    prevBotsRef.current = map;
  }, [bots, soundEnabled]);

  const handleClick = useCallback((username: string) => {
    if (onBotClick) {
      onBotClick(username);
    } else {
      router.push(`/bots/${username}`);
    }
  }, [onBotClick, router]);

  const [bookmarkedUsernames, setBookmarkedUsernames] = useState<string[]>([]);

  useEffect(() => {
    const prefs = getPreferences();
    setBookmarkedUsernames(prefs.bookmarkedBots);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setBookmarkedUsernames(detail.bookmarkedBots || []);
    };
    window.addEventListener('aims-preferences-change', handler);
    return () => window.removeEventListener('aims-preferences-change', handler);
  }, []);

  const favorites = bots.filter(b => bookmarkedUsernames.includes(b.username));
  const online = bots.filter(b => b.isOnline);
  const offline = bots.filter(b => !b.isOnline);

  const isThinking = (bot: BuddyBot) => {
    if (!bot.lastActivity) return false;
    return Date.now() - new Date(bot.lastActivity).getTime() < 5 * 60 * 1000;
  };

  const BotEntry = ({ bot }: { bot: BuddyBot }) => (
    <div
      onClick={() => handleClick(bot.username)}
      className="flex items-center gap-2 px-4 py-1.5 cursor-pointer buddy-entry"
      role="button"
      tabIndex={0}
      aria-label={`View ${bot.displayName || bot.username}'s profile${bot.isOnline ? ' (online)' : ' (offline)'}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(bot.username); } }}
    >
      <span className="relative flex-shrink-0">
        <BotAvatar username={bot.username} avatarUrl={bot.avatarUrl} size={20} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${bot.isOnline ? 'online-pulse' : ''}`}
          style={{
            background: bot.isOnline
              ? 'linear-gradient(180deg, #4CAF50 0%, #2E7D32 100%)'
              : 'linear-gradient(180deg, #bbb 0%, #888 100%)',
          }}
        />
      </span>
      <span className="font-bold text-sm text-[#003399] truncate">
        {bot.displayName || bot.username}
      </span>
      {isThinking(bot) ? (
        <span className="text-[10px] text-purple-500 italic flex-shrink-0 flex items-center gap-1">
          <span className="inline-flex gap-[2px]">
            <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          thinking
        </span>
      ) : bot.statusMessage ? (
        <span className="text-xs text-gray-500 italic truncate flex-1 min-w-0">
          — {bot.statusMessage}
        </span>
      ) : null}
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
      className="flex items-center gap-1 px-2 py-1 cursor-pointer select-none font-bold text-xs text-[#333] uppercase tracking-wide group-header"
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
      {favorites.length > 0 && (
        <>
          <div
            className="flex items-center gap-1 px-2 py-1 select-none font-bold text-xs uppercase tracking-wide"
            style={{
              background: 'linear-gradient(180deg, #fff8dc 0%, #ffe082 100%)',
              borderTop: '1px solid #fff',
              borderBottom: '1px solid #d4a017',
              color: '#8B6914',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#8B6914" className="flex-shrink-0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span>Favorites ({favorites.length})</span>
          </div>
          <div className="py-1 bg-yellow-50/30">
            {favorites.map(bot => <BotEntry key={`fav-${bot.username}`} bot={bot} />)}
          </div>
        </>
      )}
      <GroupHeader label="Online" count={online.length} open={onlineOpen} toggle={() => setOnlineOpen(!onlineOpen)} />
      {onlineOpen && (
        <div className="py-1">
          {online.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-2 italic">No agents online</p>
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
