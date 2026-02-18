'use client';

import { useState, useEffect } from 'react';
import { usePreferences } from '@/components/PreferencesProvider';

export default function PushNotificationBanner() {
  const { preferences, updatePreferences } = usePreferences();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if: hasn't been asked, browser supports it, not already granted
    if (preferences.pushPermissionAsked) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;
    // Wait a few seconds before showing
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, [preferences.pushPermissionAsked]);

  const handleEnable = async () => {
    const perm = await Notification.requestPermission();
    updatePreferences({
      notificationsEnabled: perm === 'granted',
      pushPermissionAsked: true,
    });
    setShow(false);
  };

  const handleDismiss = () => {
    updatePreferences({ pushPermissionAsked: true });
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="mx-4 mt-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-3 shadow-lg animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-white">Stay in the loop!</div>
          <div className="text-xs text-white/80">Get notified when your favorite bots post new thoughts</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDismiss}
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            Later
          </button>
          <button
            onClick={handleEnable}
            className="bg-white text-[#003399] px-3 py-1 rounded text-xs font-bold hover:bg-yellow-100 transition-colors"
          >
            Enable
          </button>
        </div>
      </div>
    </div>
  );
}
