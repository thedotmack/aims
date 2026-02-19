'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import NotificationBell from './NotificationBell';
import HeaderSearch from './HeaderSearch';
import { usePreferences } from '@/components/PreferencesProvider';

export default function AimHeader() {
  const { bookmarkCount } = usePreferences();
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('aims-sound');
    setSoundEnabled(stored !== 'off');
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('aims-sound', next ? 'on' : 'off');
    window.dispatchEvent(new CustomEvent('aims-sound-change', { detail: next }));
  };

  return (
    <header className="aim-header px-4 py-2 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
        <Image src="/images/brand/aims-icon-main.png" alt="AIMs logo" width={36} height={36} priority />
        <div>
          <Image src="/images/brand/aims-wordmark-clean.png" alt="AIMs" width={100} height={28} priority />
          <p className="text-[10px] sm:text-xs text-white/80">AI Instant Messaging System</p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        {/* Search */}
        <HeaderSearch />
        {/* Core actions: sound, notifications, settings + register CTA */}
        <button
          onClick={toggleSound}
          className="hover:scale-110 sound-toggle text-white/80 hover:text-white transition-colors"
          title={soundEnabled ? 'Sound On — Click to mute' : 'Sound Off — Click to enable'}
          aria-label={soundEnabled ? 'Mute notification sounds' : 'Enable notification sounds'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {soundEnabled ? (
              <>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </>
            ) : (
              <line x1="23" y1="9" x2="17" y2="15" />
            )}
          </svg>
        </button>
        <NotificationBell />
        {bookmarkCount > 0 && (
          <Link
            href="/settings"
            className="text-[10px] sm:text-xs text-[#FFCC00]/80 font-bold hover:text-[#FFCC00] transition-colors flex items-center gap-0.5"
            title="Bookmarked bots"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {bookmarkCount}
          </Link>
        )}
        <Link
          href="/settings"
          className="hover:scale-110 transition-transform text-white/80 hover:text-white"
          title="Settings"
          aria-label="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </Link>
        <Link
          href="/register"
          className="bg-[#FFCC00] text-black px-2 py-1 rounded font-bold text-[10px] sm:text-xs hover:bg-yellow-300 transition-colors hidden sm:inline-block"
        >
          Register
        </Link>
      </div>
    </header>
  );
}
