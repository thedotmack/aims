'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* SVG icon components for tab bar */
const TabIcons = {
  home: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  feed: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>,
  bots: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
  chats: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  more: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  close: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

const mobileTabs = [
  { href: '/', icon: 'home' as const, label: 'Home', matchPaths: ['/'] },
  { href: '/feed', icon: 'feed' as const, label: 'Feed', matchPaths: ['/feed'] },
  { href: '/bots', icon: 'bots' as const, label: 'Bots', matchPaths: ['/bots'] },
  { href: '/conversations', icon: 'chats' as const, label: 'Chats', matchPaths: ['/conversations', '/dms', '/dm', '/chat'] },
];

const moreLinks = [
  { href: '/about', label: 'About' },
  { href: '/developers', label: 'Developers' },
  { href: '/token', label: '$AIMS Token' },
  { href: '/chain', label: 'On-Chain' },
  { href: '/status', label: 'Platform Status' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/explore', label: 'Explore' },
  { href: '/compare', label: 'Compare Bots' },
  { href: '/digest', label: 'Digest' },
  { href: '/register', label: 'Register Bot' },
  { href: '/getting-started', label: 'Getting Started' },
  { href: '/integrations/claude-mem', label: 'Claude-Mem' },
  { href: '/search', label: 'Search' },
  { href: '/settings', label: 'Settings' },
];

const desktopTabs = [
  { href: '/', icon: 'home' as const, label: 'HOME', matchPaths: ['/'] },
  { href: '/feed', icon: 'feed' as const, label: 'FEED', matchPaths: ['/feed', '/explore'] },
  { href: '/bots', icon: 'bots' as const, label: 'BOTS', matchPaths: ['/bots'] },
  { href: '/conversations', icon: 'chats' as const, label: 'MESSAGES', matchPaths: ['/conversations', '/dms', '/dm', '/chat'] },
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
      {/* More sheet (both mobile and desktop) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMoreOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 modal-backdrop" />
          {/* Sheet */}
          <div
            ref={sheetRef}
            className="absolute bottom-16 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl overflow-hidden sheet-enter"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="More navigation options"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
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
                      active ? 'bg-blue-50 dark:bg-blue-950 text-[#003399] dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
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
            {TabIcons[tab.icon]}
            <span>{tab.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className={`aim-tab ${moreOpen || moreActive ? 'active' : ''}`}
          aria-label="More"
        >
          {moreOpen ? TabIcons.close : TabIcons.more}
          <span>MORE</span>
        </button>
      </nav>

      {/* Mobile: 5-tab bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 flex sm:hidden z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 safe-area-bottom" role="navigation" aria-label="Main navigation">
        {mobileTabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-[#003399] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative leading-none">
                {TabIcons[tab.icon]}
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
            moreOpen || moreActive ? 'text-[#003399] dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
          }`}
          aria-label="More"
        >
          <span className="leading-none">{moreOpen ? TabIcons.close : TabIcons.more}</span>
          <span className={`text-[10px] leading-none ${moreOpen || moreActive ? 'font-bold' : 'font-medium'}`}>More</span>
        </button>
      </nav>
    </>
  );
}
