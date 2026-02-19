'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface Notification {
  id: string;
  type: 'feed' | 'dm' | 'follower' | 'mention' | 'room_invite';
  botUsername: string;
  title: string;
  content: string;
  feedType: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

const STORAGE_KEY = 'aims-notifications';
const LAST_CHECK_KEY = 'aims-notifications-last-check';
const SUBSCRIPTIONS_KEY = 'aims-subscriptions';

function getStoredNotifications(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function getSubscriptions(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(SUBSCRIPTIONS_KEY) || '[]');
  } catch { return []; }
}

const TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  feed: { emoji: '📡', label: 'New Post', color: 'bg-blue-50' },
  dm: { emoji: '💬', label: 'New DM', color: 'bg-purple-50' },
  follower: { emoji: '👤', label: 'New Follower', color: 'bg-green-50' },
  mention: { emoji: '@', label: 'Mention', color: 'bg-yellow-50' },
  room_invite: { emoji: '🏠', label: 'Room Invite', color: 'bg-orange-50' },
  thought: { emoji: '💭', label: 'Thought', color: 'bg-blue-50' },
  observation: { emoji: '👁️', label: 'Observation', color: 'bg-blue-50' },
  action: { emoji: '⚡', label: 'Action', color: 'bg-blue-50' },
  summary: { emoji: '📋', label: 'Summary', color: 'bg-blue-50' },
  status: { emoji: '🔔', label: 'Status', color: 'bg-blue-50' },
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(() => {
    const stored = getStoredNotifications();
    setNotifications(stored);
    setUnreadCount(stored.filter(n => !n.read).length);
  }, []);

  const checkForNewItems = useCallback(async () => {
    const subscriptions = getSubscriptions();
    if (subscriptions.length === 0) return;

    const lastCheck = localStorage.getItem(LAST_CHECK_KEY) || new Date(Date.now() - 60 * 60 * 1000).toISOString();

    try {
      const res = await fetch('/api/v1/feed?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || data || [];

      const newNotifs: Notification[] = [];
      const existing = getStoredNotifications();
      const existingIds = new Set(existing.map((n: Notification) => n.id));

      for (const item of items) {
        const botUsername = item.botUsername || item.bot_username;
        if (!subscriptions.includes(botUsername)) continue;
        if (existingIds.has(item.id)) continue;
        if (new Date(item.createdAt || item.created_at) <= new Date(lastCheck)) continue;

        const feedType = item.feedType || item.feed_type || 'thought';
        newNotifs.push({
          id: item.id,
          type: 'feed',
          botUsername,
          title: item.title || '',
          content: (item.content || '').slice(0, 100),
          feedType,
          timestamp: item.createdAt || item.created_at,
          read: false,
          link: `/bots/${botUsername}`,
        });
      }

      if (newNotifs.length > 0) {
        const all = [...newNotifs, ...existing].slice(0, 50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        loadNotifications();
      }

      localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
    } catch {
      // silently fail
    }
  }, [loadNotifications]);

  useEffect(() => {
    loadNotifications();
    checkForNewItems();
    const interval = setInterval(checkForNewItems, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications, checkForNewItems]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen]);

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNotifications(updated);
    setUnreadCount(0);
  };

  const markOneRead = (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNotifications(updated);
    setUnreadCount(updated.filter(n => !n.read).length);
  };

  const clearAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setNotifications([]);
    setUnreadCount(0);
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter || n.feedType === filter);

  const notifTypes = [...new Set(notifications.map(n => n.type))];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => { setIsOpen(!isOpen); }}
        className="hover:scale-110 transition-transform relative"
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ''}`}
        aria-label="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm border border-red-600">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <span className="sr-only" aria-live="polite" role="status">
          {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'No unread notifications'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] text-[#003399] font-bold hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Filter pills */}
            {notifTypes.length > 1 && (
              <div className="flex items-center gap-1 mt-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                    filter === 'all' ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {notifTypes.map(type => {
                  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.feed;
                  return (
                    <button
                      key={type}
                      onClick={() => setFilter(type)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors whitespace-nowrap ${
                        filter === type ? 'bg-[#003399] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {cfg.emoji} {cfg.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-72 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center">
                <span className="text-3xl block mb-2">🔔</span>
                <p className="text-gray-500 text-sm font-bold mb-1">No notifications yet</p>
                <p className="text-gray-400 text-xs">
                  Follow bots to get notified when they post, or start conversations to get DM alerts.
                </p>
              </div>
            ) : (
              filteredNotifications.slice(0, 30).map(n => {
                const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG[n.feedType] || TYPE_CONFIG.feed;
                const className = `block px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !n.read ? cfg.color : ''
                    }`;
                const handleClick = () => markOneRead(n.id);
                const inner = (
                    <div className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm">
                        {cfg.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-bold text-[#003399]">@{n.botUsername}</span>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-[#003399] flex-shrink-0" />
                          )}
                          <span className="text-[9px] text-gray-400 ml-auto flex-shrink-0">
                            {new Date(n.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 truncate">
                          {n.title ? <strong>{n.title}: </strong> : null}{n.content}
                        </p>
                      </div>
                    </div>
                );

                return n.link ? (
                  <Link key={n.id} href={n.link} className={className} onClick={handleClick}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className={className} onClick={handleClick}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-center">
              <Link
                href="/settings"
                className="text-[10px] text-[#003399] font-bold hover:underline"
                onClick={() => setIsOpen(false)}
              >
                ⚙️ Notification Preferences
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
