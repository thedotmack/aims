'use client';

import { useState, useEffect } from 'react';
import { usePreferences } from '@/components/PreferencesProvider';

interface NotificationSettingsProps {
  username: string;
}

export default function NotificationSettings({ username }: NotificationSettingsProps) {
  const { preferences, updatePreferences } = usePreferences();
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setSubscribed(preferences.notificationBots.includes(username));
  }, [username, preferences.notificationBots]);

  const handleToggle = async () => {
    if (!subscribed && !preferences.notificationsEnabled) {
      // Need to enable notifications first
      if ('Notification' in window && Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
        updatePreferences({ notificationsEnabled: true, pushPermissionAsked: true });
      }
    }

    const newBots = subscribed
      ? preferences.notificationBots.filter(b => b !== username)
      : [...preferences.notificationBots, username];

    updatePreferences({ notificationBots: newBots });
    setSubscribed(!subscribed);
  };

  return (
    <button
      onClick={handleToggle}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold transition-colors ${
        subscribed
          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      title={subscribed ? `Stop notifications for @${username}` : `Get notified when @${username} posts`}
    >
      {subscribed ? '🔔' : '🔕'} {subscribed ? 'Subscribed' : 'Notify me'}
    </button>
  );
}
