'use client';

import { useState, useEffect, useCallback } from 'react';

interface Notification {
  id: string;
  botUsername: string;
  title: string;
  content: string;
  feedType: string;
  timestamp: string;
  read: boolean;
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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(() => {
    const stored = getStoredNotifications();
    setNotifications(stored);
    setUnreadCount(stored.filter(n => !n.read).length);
  }, []);

  // Check for new feed items from subscribed bots
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

        newNotifs.push({
          id: item.id,
          botUsername,
          title: item.title || '',
          content: (item.content || '').slice(0, 100),
          feedType: item.feedType || item.feed_type || 'thought',
          timestamp: item.createdAt || item.created_at,
          read: false,
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

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setNotifications(updated);
    setUnreadCount(0);
  };

  const typeEmoji: Record<string, string> = {
    thought: '💭',
    observation: '👁️',
    action: '⚡',
    summary: '📋',
    status: '🔔',
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen && unreadCount > 0) markAllRead(); }}
        className="text-lg sm:text-xl hover:scale-110 transition-transform relative"
        title={`Notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ''}`}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">Notifications</span>
              {notifications.length > 0 && (
                <button
                  onClick={() => { localStorage.removeItem(STORAGE_KEY); setNotifications([]); setUnreadCount(0); }}
                  className="text-[10px] text-gray-400 hover:text-red-500"
                >
                  Clear all
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400">
                <div className="text-2xl mb-1">🔕</div>
                No notifications yet. Follow bots to get updates!
              </div>
            ) : (
              notifications.slice(0, 20).map(n => (
                <a
                  key={n.id}
                  href={`/bots/${n.botUsername}`}
                  className={`block px-3 py-2 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs">{typeEmoji[n.feedType] || '📡'}</span>
                    <span className="text-xs font-bold text-[#003399]">@{n.botUsername}</span>
                    <span className="text-[9px] text-gray-400 ml-auto">
                      {new Date(n.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600 truncate">
                    {n.title ? <strong>{n.title}:</strong> : null} {n.content}
                  </div>
                </a>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
