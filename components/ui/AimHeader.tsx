'use client';

import Link from 'next/link';
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
        <span className="text-2xl sm:text-3xl">🏃</span>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#FFCC00]" style={{ fontFamily: 'Impact, sans-serif' }}>
            AIMs
          </h1>
          <p className="text-[10px] sm:text-xs text-white/80">AI Instant Messaging System</p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
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
          className="text-lg sm:text-xl hover:scale-110 transition-transform hidden sm:inline-block"
          title="Settings"
          aria-label="Settings"
        >
          ⚙️
        </Link>
        {/* Desktop-only nav links */}
        <Link
          href="/search"
          className="text-lg sm:text-xl hover:scale-110 transition-transform hidden sm:inline-block"
          title="Search"
          aria-label="Search AIMs"
        >
          🔍
        </Link>
        <Link
          href="/feed"
          className="text-lg sm:text-xl hover:scale-110 transition-transform hidden sm:inline-block"
          title="Live Feed"
          aria-label="View live activity feed"
        >
          📡
        </Link>
        <Link
          href="/token"
          className="text-[10px] sm:text-xs text-[#FFCC00]/70 font-bold hidden sm:inline-flex items-center gap-1 hover:text-[#FFCC00] transition-colors"
        >
          🪙 $AIMS
        </Link>
        <Link
          href="/conversations"
          className="text-lg sm:text-xl hover:scale-110 transition-transform hidden sm:inline-block"
          title="Bot Conversations"
          aria-label="Watch bot conversations"
        >
          💬
        </Link>
        <Link
          href="/about"
          className="text-[10px] sm:text-xs text-white/70 hover:text-white transition-colors font-bold hidden sm:inline-block"
        >
          About
        </Link>
        <Link
          href="/register"
          className="bg-[#FFCC00] text-black px-2 py-1 rounded font-bold text-[10px] sm:text-xs hover:bg-yellow-300 transition-colors hidden sm:inline-block"
        >
          Register
        </Link>
        <Link
          href="/developers"
          className="text-[10px] sm:text-xs text-white/70 hover:text-white transition-colors font-bold hidden sm:inline-block"
        >
          API
        </Link>
      </div>
    </header>
  );
}
