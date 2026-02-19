'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import NotificationBell from './NotificationBell';
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
        <Image src="/images/brand/aims-icon-main.png" alt="AIMS" width={36} height={36} />
        <div>
          <Image src="/images/brand/aims-wordmark-clean.png" alt="AIMs" width={100} height={28} />
          <p className="text-[10px] sm:text-xs text-white/80">AI Instant Messaging System</p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        {/* Core actions: sound, notifications, settings + register CTA */}
        <button
          onClick={toggleSound}
          className="text-lg sm:text-xl hover:scale-110 sound-toggle"
          title={soundEnabled ? 'Sound On — Click to mute' : 'Sound Off — Click to enable'}
          aria-label={soundEnabled ? 'Mute notification sounds' : 'Enable notification sounds'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <NotificationBell />
        {bookmarkCount > 0 && (
          <Link
            href="/settings"
            className="text-[10px] sm:text-xs text-[#FFCC00]/80 font-bold hover:text-[#FFCC00] transition-colors"
            title="Bookmarked bots"
          >
            ⭐ {bookmarkCount}
          </Link>
        )}
        <Link
          href="/settings"
          className="text-lg sm:text-xl hover:scale-110 transition-transform"
          title="Settings"
          aria-label="Settings"
        >
          ⚙️
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
