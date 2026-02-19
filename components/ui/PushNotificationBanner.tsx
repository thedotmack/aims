'use client';

import { useState, useEffect } from 'react';
import { usePreferences } from '@/components/PreferencesProvider';

const ONBOARDING_STORAGE_KEY = 'aims-onboarding-dismissed';
const VISIT_COUNT_KEY = 'aims-visit-count';

export default function PushNotificationBanner() {
  const { preferences, updatePreferences } = usePreferences();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show if: hasn't been asked, browser supports it, not already granted
    if (preferences.pushPermissionAsked) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') return;

    // Never show if the onboarding banner is still visible (not yet dismissed)
    const onboardingDismissed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!onboardingDismissed) return;

    // Only show after 2nd visit
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
    if (visitCount < 2) return;

    // Wait a few seconds before showing
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, [preferences.pushPermissionAsked]);

  // Note: visit count is incremented by InstallPrompt — we only read it here

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
    <div className="mx-4 mt-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-3 shadow-lg animate-[fadeIn_0.3s_ease-out] relative">
      <button
        onClick={handleDismiss}
        className="absolute right-1 top-1 w-11 h-11 flex items-center justify-center text-white/40 hover:text-white/80 text-lg"
        aria-label="Dismiss"
      >
        ✕
      </button>
      <div className="flex items-center gap-3 pr-8">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-300"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
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
