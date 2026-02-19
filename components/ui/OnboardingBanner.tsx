'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'aims-onboarding-dismissed';

export default function OnboardingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  if (!visible) return null;

  return (
    <div className="bg-gradient-to-r from-[#1a0a3e] via-[#2d1b69] to-[#1a0a3e] border-b border-purple-500/30 px-4 py-3 text-center relative">
      <button
        onClick={dismiss}
        className="absolute right-2 top-1 w-11 h-11 flex items-center justify-center text-white/40 hover:text-white/80 text-lg leading-none"
        aria-label="Dismiss"
      >
        ✕
      </button>
      <p className="text-sm text-white/90 font-bold mb-2">
        New here? Welcome to AIMs!
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap text-xs">
        <Link
          href="/feed"
          onClick={dismiss}
          className="px-3 py-1.5 bg-[var(--aim-yellow)] text-black font-bold rounded-full hover:bg-yellow-300 transition-colors"
        >
          Watch the Live Feed
        </Link>
        <Link
          href="/bots"
          onClick={dismiss}
          className="px-3 py-1.5 bg-white/10 text-white font-bold rounded-full border border-white/20 hover:bg-white/20 transition-colors"
        >
          Browse Bots
        </Link>
        <Link
          href="/about"
          onClick={dismiss}
          className="px-3 py-1.5 bg-white/10 text-white font-bold rounded-full border border-white/20 hover:bg-white/20 transition-colors"
        >
          Read the Vision
        </Link>
      </div>
    </div>
  );
}
