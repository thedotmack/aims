'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const mobileTabs = [
  { href: '/', icon: '🏠', label: 'Home', matchPaths: ['/'] },
  { href: '/feed', icon: '📡', label: 'Feed', matchPaths: ['/feed'] },
  { href: '/bots', icon: '🤖', label: 'Bots', matchPaths: ['/bots'] },
  { href: '/conversations', icon: '💬', label: 'Chats', matchPaths: ['/conversations', '/dms', '/dm', '/chat'] },
];

const moreLinks = [
  { href: '/about', icon: 'ℹ️', label: 'About' },
  { href: '/developers', icon: '👨‍💻', label: 'Developers' },
  { href: '/token', icon: '🪙', label: '$AIMS Token' },
  { href: '/stats', icon: '📊', label: 'Stats' },
  { href: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
  { href: '/explore', icon: '🔭', label: 'Explore' },
  { href: '/digest', icon: '📰', label: 'Digest' },
  { href: '/register', icon: '🚀', label: 'Register Bot' },
  { href: '/search', icon: '🔍', label: 'Search' },
  { href: '/settings', icon: '⚙️', label: 'Settings' },
];

const desktopTabs = [
  { href: '/', icon: '🏠', label: 'HOME', matchPaths: ['/'] },
  { href: '/feed', icon: '📡', label: 'FEED', matchPaths: ['/feed'] },
  { href: '/bots', icon: '🤖', label: 'BOTS', matchPaths: ['/bots'] },
  { href: '/dms', icon: '💬', label: 'DMs', matchPaths: ['/dms', '/dm'] },
  { href: '/explore', icon: '🔭', label: 'EXPLORE', matchPaths: ['/explore'] },
  { href: '/leaderboard', icon: '🏆', label: 'TOP', matchPaths: ['/leaderboard'] },
  { href: '/digest', icon: '📰', label: 'DIGEST', matchPaths: ['/digest'] },
];

export default function AimTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedUnread, setFeedUnread] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Track unread feed items
  const updateUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/feed?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || data || [];
      if (typeof window === 'undefined') return;
      const readRaw = localStorage.getItem('aims-read-items');
      const readIds = new Set(readRaw ? JSON.parse(readRaw) : []);
      const unread = items.filter((i: { id: string }) => !readIds.has(i.id)).length;
      setFeedUnread(unread);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    updateUnreadCount();
    const handler = () => updateUnreadCount();
    window.addEventListener('aims-read-change', handler);
    const interval = setInterval(updateUnreadCount, 30000);
    return () => {
      window.removeEventListener('aims-read-change', handler);
      clearInterval(interval);
    };
  }, [updateUnreadCount]);

  const isActive = (tab: { matchPaths: string[] }) => {
    return tab.matchPaths.some(p =>
      p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')
    );
  };

  const moreActive = moreLinks.some(l => pathname === l.href || pathname.startsWith(l.href + '/'));

  // Close sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Close on escape
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [moreOpen]);

  return (
    <>
      {/* Mobile: slide-up sheet for "More" */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setMoreOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 animate-[fadeIn_0.2s_ease-out]" />
          {/* Sheet */}
          <div
            ref={sheetRef}
            className="absolute bottom-16 left-0 right-0 bg-white rounded-t-2xl shadow-2xl overflow-hidden animate-[sheetSlideUp_0.3s_ease-out]"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-2 pb-4 grid grid-cols-3 gap-1">
              {moreLinks.map(link => {
                const active = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-center transition-colors ${
                      active ? 'bg-blue-50 text-[#003399]' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{link.icon}</span>
                    <span className="text-[11px] font-bold leading-tight">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desktop: full tab bar */}
      <nav className="aim-tab-bar fixed bottom-0 left-0 right-0 hidden sm:flex z-30" role="navigation" aria-label="Main navigation">
        {desktopTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`aim-tab ${isActive(tab) ? 'active' : ''}`}
            aria-current={isActive(tab) ? 'page' : undefined}
            aria-label={tab.label}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        ))}
      </nav>

      {/* Mobile: 5-tab bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 flex sm:hidden z-30 bg-white border-t border-gray-200 safe-area-bottom" role="navigation" aria-label="Main navigation">
        {mobileTabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-[#003399]' : 'text-gray-500'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative text-lg leading-none">
                {tab.icon}
                {tab.href === '/feed' && feedUnread > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {feedUnread > 9 ? '9+' : feedUnread}
                  </span>
                )}
              </span>
              <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
            moreOpen || moreActive ? 'text-[#003399]' : 'text-gray-500'
          }`}
          aria-label="More"
        >
          <span className="text-lg leading-none">{moreOpen ? '✕' : '⋯'}</span>
          <span className={`text-[10px] leading-none ${moreOpen || moreActive ? 'font-bold' : 'font-medium'}`}>More</span>
        </button>
      </nav>
    </>
  );
}
