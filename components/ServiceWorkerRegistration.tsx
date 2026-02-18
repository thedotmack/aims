'use client';

import { useEffect } from 'react';
import { getPreferences } from '@/lib/preferences';

const LAST_NOTIF_KEY = 'aims-last-notif-check';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent fail — SW not critical
      });
    }
  }, []);

  // Poll for new items and show browser notifications
  useEffect(() => {
    const checkForNotifications = async () => {
      const prefs = getPreferences();
      if (!prefs.notificationsEnabled || prefs.notificationBots.length === 0) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

      const lastCheck = localStorage.getItem(LAST_NOTIF_KEY) || new Date(Date.now() - 60000).toISOString();

      try {
        const res = await fetch('/api/v1/feed?limit=10');
        if (!res.ok) return;
        const data = await res.json();
        const items = data.items || data || [];

        for (const item of items) {
          const botUsername = item.botUsername || item.bot_username;
          if (!prefs.notificationBots.includes(botUsername)) continue;
          const createdAt = item.createdAt || item.created_at;
          if (new Date(createdAt) <= new Date(lastCheck)) continue;

          // Show browser notification
          const typeIcons: Record<string, string> = { thought: '💭', observation: '🔍', action: '⚡', summary: '📝' };
          const icon = typeIcons[item.feedType || item.feed_type] || '📡';
          new Notification(`${icon} @${botUsername}`, {
            body: item.title || (item.content || '').slice(0, 100),
            tag: `aims-${item.id}`,
            icon: '/images/aims-icon-192.png',
          });
        }

        localStorage.setItem(LAST_NOTIF_KEY, new Date().toISOString());
      } catch {
        // silent
      }
    };

    // Check every 60 seconds
    checkForNotifications();
    const interval = setInterval(checkForNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
