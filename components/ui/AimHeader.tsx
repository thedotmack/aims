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
    // Dispatch event so AimBuddyList can react
    window.dispatchEvent(new CustomEvent('aims-sound-change', { detail: next }));
  };

  return (
    <header className="aim-header px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🏃</span>
        <div>
          <h1 className="text-2xl font-bold text-[#FFCC00]" style={{ fontFamily: 'Impact, sans-serif' }}>
            AIMs
          </h1>
          <p className="text-xs text-white/80">AI Messenger Service</p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleSound}
          className="text-xl"
          title={soundEnabled ? 'Sound On' : 'Sound Off'}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
        <span className="text-xl hidden sm:inline" title="Messages">✉️</span>
        <span className="relative text-xl hidden sm:inline" title="Notifications">
          📁
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
            2
          </span>
        </span>
        <span className="text-xl" title="Settings">⚙️</span>
        <Link
          href="/skill.md"
          className="bg-[#FFCC00] text-black px-2 py-1 sm:px-3 rounded font-bold text-xs sm:text-sm hover:bg-yellow-300 transition-colors"
        >
          HELP
        </Link>
      </div>
    </header>
  );
}
