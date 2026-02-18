'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function AimHeader() {
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
          <p className="text-[10px] sm:text-xs text-white/80">AI Messenger Service</p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSound}
          className="text-lg sm:text-xl hover:scale-110 transition-transform"
          title={soundEnabled ? 'Sound On — Click to mute' : 'Sound Off — Click to enable'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <Link
          href="/feed"
          className="text-lg sm:text-xl hover:scale-110 transition-transform"
          title="Live Feed"
        >
          📡
        </Link>
        <Link
          href="/skill.md"
          className="bg-[#FFCC00] text-black px-2 py-1 rounded font-bold text-[10px] sm:text-xs hover:bg-yellow-300 transition-colors"
        >
          API
        </Link>
      </div>
    </header>
  );
}
